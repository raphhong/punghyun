-- ADDITIVE DRAFT: inspect the live schema, grants and existing row fingerprints first.
-- Requires the existing cashflow_profiles/cashflow_movements schema. No seeds/backfill.
-- Apply as one transaction only after explicit approval of this DB change.
begin;

do $$ begin
  if to_regclass('public.cashflow_profiles') is null or to_regclass('public.cashflow_movements') is null then
    raise exception 'Existing cashflow tables must be verified before this migration';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='payment_schedule' and data_type <> 'jsonb') then
    raise exception 'Existing payment_schedule requires separate compatibility review';
  end if;
end $$;
alter table public.customers add column if not exists payment_schedule jsonb;

-- New rows only; every request records its result and before/after evidence atomically.
create table public.cashflow_write_audit (
  request_id uuid primary key,
  customer_id uuid not null references public.customers(id) on delete restrict,
  actor_id uuid not null,
  change jsonb not null,
  reason text not null check (length(trim(reason)) between 4 and 500),
  before_state jsonb not null,
  after_state jsonb not null,
  result jsonb not null,
  recorded_at timestamptz not null default now()
);
alter table public.cashflow_write_audit enable row level security;
revoke all on public.cashflow_write_audit from public, anon, authenticated;
-- The definer functions below are the only new entry points. No browser write grants.

create function public.cashflow_valid_date(v text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if v is null or v !~ '^(19|20|21)[0-9]{2}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return to_char(v::date, 'YYYY-MM-DD') = v;
exception when others then return false;
end $$;
create function public.cashflow_valid_integer(v jsonb, minimum numeric, maximum numeric) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' then return false; end if;
  return v::text::numeric between minimum and maximum;
end $$;

create function public.cashflow_snapshot(p_customer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'customer', jsonb_build_object('first_payment_date', c.first_payment_date, 'rental_months', c.rental_months,
      'rental_price', c.rental_price, 'payment_schedule', c.payment_schedule, 'paid_count', c.paid_count,
      'receipt_ledger', to_jsonb(c)->'receipt_ledger'),
    'profile', (select to_jsonb(p) from public.cashflow_profiles p where p.customer_id = c.id),
    'movements', coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.cashflow_movements m where m.customer_id = c.id), '[]'::jsonb)
  ) from public.customers c where c.id = p_customer;
$$;

create function public.read_customer_cashflow(p_actor uuid, p_customer uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare state jsonb;
begin
  if p_actor is null or not exists(select 1 from public.admins where user_id = p_actor) then raise exception 'CASHFLOW_FORBIDDEN'; end if;
  state := public.cashflow_snapshot(p_customer);
  if state is null then raise exception 'CASHFLOW_NOT_FOUND'; end if;
  return jsonb_build_object('version', md5(state::text), 'snapshot', state);
end $$;

create function public.save_customer_cashflow(p_actor uuid, p_customer uuid, p_request uuid, p_expected_version text, p_change jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  before_state jsonb; after_state jsonb; result jsonb; prior public.cashflow_write_audit%rowtype;
  existing public.cashflow_movements%rowtype; line jsonb; idx integer := 0; total numeric := 0;
  last_date text := ''; months integer; operation text; movement_id uuid;
  today date := (now() at time zone 'Asia/Seoul')::date;
  violated_constraint text;
begin
  -- A caller can only invoke this through the service-role server after session validation.
  -- Recheck membership inside the same transaction; lookup errors abort, never permit.
  if p_actor is null or not exists(select 1 from public.admins where user_id = p_actor) then raise exception 'CASHFLOW_FORBIDDEN'; end if;
  if p_customer is null or p_request is null or p_expected_version is null or p_expected_version !~ '^[a-f0-9]{32}$' or jsonb_typeof(p_change) is distinct from 'object' then raise exception 'CASHFLOW_INVALID'; end if;
  -- Stable lock order: global request, global normalized evidence, then customer.
  -- Cross-customer retries/evidence cannot race past the audit/source UNIQUE keys.
  perform pg_advisory_xact_lock(hashtextextended('cashflow-request:' || p_request::text, 0));
  if p_change->>'operation' = 'movement' and jsonb_typeof(p_change->'source_reference') = 'string' then
    perform pg_advisory_xact_lock(hashtextextended('cashflow-source:' || trim(p_change->>'source_reference'), 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text, 0));
  perform 1 from public.customers where id = p_customer for update;
  if not found then raise exception 'CASHFLOW_NOT_FOUND'; end if;
  select * into prior from public.cashflow_write_audit where request_id = p_request;
  if found then
    if prior.customer_id <> p_customer or prior.actor_id <> p_actor or prior.change <> p_change then raise exception 'CASHFLOW_REQUEST_REUSED'; end if;
    -- Return CURRENT state: a successful retry must not reset the UI to an older snapshot.
    return public.read_customer_cashflow(p_actor, p_customer);
  end if;
  before_state := public.cashflow_snapshot(p_customer);
  if md5(before_state::text) <> p_expected_version then raise exception 'CASHFLOW_CONFLICT'; end if;
  if jsonb_typeof(p_change->'reason') is distinct from 'string' or length(trim(p_change->>'reason')) not between 4 and 500 then raise exception 'CASHFLOW_INVALID'; end if;
  operation := p_change->>'operation';
  if operation = 'schedule' then
    -- Legacy allocation semantics require separate reconciliation before edits.
    if before_state->'customer'->'receipt_ledger' is distinct from 'null'::jsonb then raise exception 'CASHFLOW_LEGACY_LEDGER'; end if;
    if not public.cashflow_valid_date(p_change->>'first_payment_date') or not public.cashflow_valid_integer(p_change->'rental_months',1,600)
      or not public.cashflow_valid_integer(p_change->'rental_price',1,9007199254740991) or not public.cashflow_valid_integer(p_change->'expected_total',1,9007199254740991)
      or jsonb_typeof(p_change->'payment_schedule') is distinct from 'array' then raise exception 'CASHFLOW_INVALID'; end if;
    months := (p_change->>'rental_months')::integer;
    if jsonb_array_length(p_change->'payment_schedule') <> months then raise exception 'CASHFLOW_INVALID'; end if;
    for line in select value from jsonb_array_elements(p_change->'payment_schedule') loop
      idx := idx + 1;
      if jsonb_typeof(line) is distinct from 'object' or not public.cashflow_valid_integer(line->'no',idx,idx)
        or not public.cashflow_valid_integer(line->'amount',1,9007199254740991) or not public.cashflow_valid_date(line->>'dueDate')
        or (line->>'dueDate') < last_date then raise exception 'CASHFLOW_INVALID'; end if;
      if idx = 1 and (line->>'dueDate') <> (p_change->>'first_payment_date') then raise exception 'CASHFLOW_INVALID'; end if;
      last_date := line->>'dueDate'; total := total + (line->>'amount')::numeric;
    end loop;
    if total > 9007199254740991 or total <> (p_change->>'expected_total')::numeric then raise exception 'CASHFLOW_INVALID'; end if;
    if exists(select 1 from public.cashflow_movements where customer_id=p_customer and installment_no>months)
      or coalesce((before_state->'customer'->>'paid_count')::integer,0)>months then raise exception 'CASHFLOW_CONFLICT'; end if;
    update public.customers set first_payment_date=(p_change->>'first_payment_date')::date, rental_months=months,
      rental_price=(p_change->>'rental_price')::bigint, payment_schedule=p_change->'payment_schedule' where id=p_customer;
  elsif operation = 'profile' then
    if not (p_change ? 'funding_type') or not (p_change ? 'creditor_name')
      or (p_change->>'funding_type') not in ('own','securitized')
      or (p_change->>'funding_type' is null and p_change->'funding_type' <> 'null'::jsonb)
      or (p_change->>'creditor_name' is not null and (jsonb_typeof(p_change->'creditor_name')<>'string' or length(trim(p_change->>'creditor_name')) not between 1 and 200)) then raise exception 'CASHFLOW_INVALID'; end if;
    if (p_change->>'funding_type' is distinct from 'securitized' and p_change->>'creditor_name' is not null)
      or (p_change->>'funding_type'='securitized' and p_change->>'creditor_name' is null) then raise exception 'CASHFLOW_INVALID'; end if;
    if p_change->>'funding_type'='own' and exists(select 1 from public.cashflow_movements where customer_id=p_customer and kind in ('creditor_payment','securitization_inflow')) then raise exception 'CASHFLOW_PROFILE_CONFLICT'; end if;
    insert into public.cashflow_profiles(customer_id,funding_type,creditor_name) values(p_customer,p_change->>'funding_type',p_change->>'creditor_name')
      on conflict(customer_id) do update set funding_type=excluded.funding_type,creditor_name=excluded.creditor_name;
  elsif operation = 'movement' then
    if not (p_change ? 'id') or not (p_change ? 'installment_no')
      or coalesce(p_change->>'kind','') not in ('funding_disbursement','rental_receipt','creditor_payment','securitization_inflow')
      or coalesce(p_change->>'basis','') not in ('planned','actual') or not public.cashflow_valid_date(p_change->>'cash_date')
      or not public.cashflow_valid_integer(p_change->'amount',1,9007199254740991)
      or jsonb_typeof(p_change->'source_reference') is distinct from 'string' or (case when p_change->>'id' is null then length(trim(p_change->>'source_reference')) not between 3 and 200 else length(trim(p_change->>'source_reference')) < 1 end)
      or jsonb_typeof(p_change->'note') is distinct from 'string' or length(p_change->>'note')>500 then raise exception 'CASHFLOW_INVALID'; end if;
    if p_change->>'basis'='actual' and (p_change->>'cash_date')::date>today then raise exception 'CASHFLOW_INVALID'; end if;
    if p_change->>'kind'='rental_receipt' then
      months := (before_state->'customer'->>'rental_months')::integer;
      if p_change->>'basis'<>'actual' or months is null or months not between 1 and 600 or not public.cashflow_valid_integer(p_change->'installment_no',1,months) then raise exception 'CASHFLOW_INVALID'; end if;
      if before_state->'customer'->'receipt_ledger' is distinct from 'null'::jsonb then raise exception 'CASHFLOW_LEGACY_LEDGER'; end if;
    elsif p_change->'installment_no' is distinct from 'null'::jsonb then raise exception 'CASHFLOW_INVALID'; end if;
    if p_change->>'kind' in ('creditor_payment','securitization_inflow') and before_state->'profile'->>'funding_type'='own' then raise exception 'CASHFLOW_PROFILE_CONFLICT'; end if;
    if p_change->>'id' is not null then
      movement_id := (p_change->>'id')::uuid;
      select * into existing from public.cashflow_movements where id=movement_id and customer_id=p_customer for update;
      if not found then raise exception 'CASHFLOW_NOT_FOUND'; end if;
      if existing.source_reference is distinct from (p_change->>'source_reference') then raise exception 'CASHFLOW_INVALID'; end if;
      -- The event's source and category stay stable; corrections only change evidence details.
      if existing.kind<>p_change->>'kind' or existing.basis<>p_change->>'basis' then raise exception 'CASHFLOW_INVALID'; end if;
    else
      if p_change->'id' is distinct from 'null'::jsonb then raise exception 'CASHFLOW_INVALID'; end if;
      movement_id := gen_random_uuid();
    end if;
    if exists(select 1 from public.cashflow_movements m where m.id<>movement_id and (trim(m.source_reference)=trim(p_change->>'source_reference')
      or (m.customer_id=p_customer and m.kind=p_change->>'kind' and m.basis=p_change->>'basis' and m.cash_date=(p_change->>'cash_date')::date
          and m.amount=(p_change->>'amount')::bigint and m.installment_no is not distinct from (p_change->>'installment_no')::integer))) then raise exception 'CASHFLOW_DUPLICATE'; end if;
    insert into public.cashflow_profiles(customer_id) values(p_customer) on conflict(customer_id) do nothing;
    if p_change->>'id' is null then
      insert into public.cashflow_movements(id,customer_id,kind,basis,cash_date,cash_month,installment_no,amount,source_reference,note)
      values(movement_id,p_customer,p_change->>'kind',p_change->>'basis',(p_change->>'cash_date')::date,null,
        (p_change->>'installment_no')::integer,(p_change->>'amount')::bigint,trim(p_change->>'source_reference'),nullif(trim(p_change->>'note'),''));
    else
      update public.cashflow_movements set cash_date=(p_change->>'cash_date')::date,cash_month=null,installment_no=(p_change->>'installment_no')::integer,
        amount=(p_change->>'amount')::bigint,note=nullif(trim(p_change->>'note'),'') where id=movement_id and customer_id=p_customer;
    end if;
  else raise exception 'CASHFLOW_INVALID'; end if;
  after_state := public.cashflow_snapshot(p_customer);
  result := jsonb_build_object('version',md5(after_state::text),'snapshot',after_state);
  insert into public.cashflow_write_audit(request_id,customer_id,actor_id,change,reason,before_state,after_state,result)
    values(p_request,p_customer,p_actor,p_change,trim(p_change->>'reason'),before_state,after_state,result);
  return result;
exception when unique_violation then
  -- A direct maintenance writer may not use these locks. This known constraint
  -- still means a definite rollback, never an uncertain network outcome.
  get stacked diagnostics violated_constraint = constraint_name;
  if violated_constraint = 'cashflow_movements_source_reference_key' then raise exception 'CASHFLOW_DUPLICATE'; end if;
  if violated_constraint = 'cashflow_write_audit_pkey' then raise exception 'CASHFLOW_REQUEST_REUSED'; end if;
  raise;
end $$;

revoke all on function public.cashflow_valid_date(text), public.cashflow_valid_integer(jsonb,numeric,numeric), public.cashflow_snapshot(uuid),
  public.read_customer_cashflow(uuid,uuid), public.save_customer_cashflow(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.read_customer_cashflow(uuid,uuid), public.save_customer_cashflow(uuid,uuid,uuid,text,jsonb) to service_role;
-- No changes to existing rows, original IDs/source references, existing table grants or RLS.
commit;
