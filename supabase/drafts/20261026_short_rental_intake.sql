-- REVIEW ONLY. Standalone intake schema: no receipt/contract migration required.
-- No anonymous/authenticated direct writes; existing customer bearer tokens are resolved in RPC.
begin;
create table public.short_rental_intakes (
 request_id uuid primary key,
 customer_id uuid not null references public.customers(id) on delete restrict,
 device_id uuid not null references public.customer_devices(id) on delete restrict,
 source text not null check(source in ('new','existing')),
 payload jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.short_rental_intakes enable row level security;
revoke all on public.short_rental_intakes from anon,authenticated,service_role;
grant select on public.short_rental_intakes to authenticated;
grant select,insert on public.short_rental_intakes to service_role;
create policy short_rental_intakes_admin_read on public.short_rental_intakes for select to authenticated using(public.is_admin(auth.uid()));
create function public.submit_short_rental_intake(p_request uuid,p_token uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare c uuid; d uuid; prior short_rental_intakes; k text; check_entry jsonb; checks jsonb;
begin
 if p_request is null or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>16000 or
  coalesce(p_payload->>'confirmed','')<>'true' or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 100 or
  coalesce(p_payload->>'phone','') !~ '^[+0-9() -]{7,40}$' or
  length(trim(coalesce(p_payload->>'model',''))) not between 1 and 200 or
  coalesce(p_payload->>'quantity','') !~ '^[0-9]{1,4}$' or (p_payload->>'quantity')::int not between 1 and 1000 then raise exception 'invalid intake'; end if;
 foreach k in array array['identity','condition','owner','rights'] loop
  if length(trim(coalesce(p_payload->>k,''))) not between 1 and 500 then raise exception 'missing information'; end if;
 end loop;
 if p_payload->>'startDate' is null or to_char((p_payload->>'startDate')::date,'YYYY-MM-DD')<>p_payload->>'startDate' or (p_payload->>'startDate')::date not between '1900-01-01' and '2199-12-24' then raise exception 'invalid start'; end if;
 foreach k in array array['privacy','guarantee','undertaking','release','landlord'] loop
  if coalesce(p_payload->'conditions'->>k,'') not in ('unknown','yes','no') then raise exception 'invalid condition'; end if;
 end loop;
 -- Serialized idempotency, including simultaneous first submission.
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 if p_token is not null then
  select id into c from customers where share_token=p_token;
  if c is null then raise exception 'invalid link'; end if;
 end if;
 select * into prior from short_rental_intakes where request_id=p_request;
 if found then
  if prior.payload=p_payload and ((p_token is null and prior.source='new') or (p_token is not null and prior.source='existing' and prior.customer_id=c)) then return jsonb_build_object('ok',true); end if;
  raise exception 'request conflict';
 end if;
 if c is not null and to_regclass('public.short_rentals') is not null then
  execute 'select checks from public.short_rentals where customer_id=$1 and confirmed_at is not null order by created_at desc limit 1' into checks using c;
 end if;
 foreach k in array array['business','identity','authority','account'] loop
  if coalesce(p_payload->'reuse'->>k,'') not in ('new','unchanged','changed','review_existing') then raise exception 'invalid reuse'; end if;
  if p_payload->'reuse'->>k='review_existing' and c is null then raise exception 'existing link required'; end if;
  if p_payload->'reuse'->>k='unchanged' then
   check_entry:=checks->k;
   if c is null or coalesce(check_entry->>'status','') not in ('verified','reused') or
    (check_entry->>'validUntil' is not null and (check_entry->>'validUntil')::date < (now() at time zone 'Asia/Seoul')::date) then raise exception 'reuse unavailable'; end if;
  end if;
 end loop;
 d:=(p_payload->>'deviceId')::uuid;
 if d is not null and (c is null or not exists(select 1 from customer_devices where id=d and customer_id=c)) then raise exception 'device outside customer'; end if;
 -- Bound repeated new leads per contact without searching or returning existing customer data.
 if c is null then
  perform pg_advisory_xact_lock(hashtextextended('intake-phone:'||regexp_replace(p_payload->>'phone','[^0-9]','','g'),0));
  if (select count(*) from short_rental_intakes where source='new' and regexp_replace(payload->>'phone','[^0-9]','','g')=regexp_replace(p_payload->>'phone','[^0-9]','','g') and created_at>now()-interval '1 day')>=3 then raise exception 'intake limit'; end if;
  insert into customers(source,stage,hospital_name,representative,phone,intake_date)
   values('homepage','intake',nullif(trim(p_payload->>'company'),''),trim(p_payload->>'name'),trim(p_payload->>'phone'),(now() at time zone 'Asia/Seoul')::date) returning id into c;
 end if;
 if d is null then
  insert into customer_devices(customer_id,model_name,quantity) values(c,trim(p_payload->>'model'),(p_payload->>'quantity')::int) returning id into d;
 end if;
 insert into short_rental_intakes(request_id,customer_id,device_id,source,payload) values(p_request,c,d,case when p_token is null then 'new' else 'existing' end,p_payload);
 -- Never returns customer ID, share token, existing documents, internal notes or a contract.
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.submit_short_rental_intake(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_short_rental_intake(uuid,uuid,jsonb) to service_role;
commit;
