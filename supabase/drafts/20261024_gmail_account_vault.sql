-- REVIEW ONLY; no credentials generated or inserted. Service-only encrypted rows.
create table public.gmail_account_vault (
  owner_id uuid not null,
  account_id text not null check(account_id ~ '^[a-z0-9_]{1,40}$'),
  mailbox text not null,
  scope text not null check(scope='https://www.googleapis.com/auth/gmail.readonly'),
  envelope jsonb not null,
  generation bigint not null default 1 check(generation>0),
  status text not null check(status in ('active','disabled','revoked','revoke_unconfirmed')),
  label_ids text[] not null check(cardinality(label_ids) between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key(owner_id,account_id), unique(owner_id,mailbox)
);
create table public.gmail_ingest_reservations (
  owner_id uuid not null,
  account_id text not null,
  source_key text not null check(source_key ~ '^[a-f0-9]{64}$'),
  generation bigint not null,
  created_at timestamptz not null default now(),
  primary key(owner_id,account_id,source_key),
  foreign key(owner_id,account_id) references public.gmail_account_vault(owner_id,account_id)
);
alter table public.gmail_account_vault enable row level security;
alter table public.gmail_ingest_reservations enable row level security;
revoke all on public.gmail_account_vault, public.gmail_ingest_reservations from public,anon,authenticated;
grant all on public.gmail_account_vault, public.gmail_ingest_reservations to service_role;
create function public.gmail_claim_source(p_owner uuid,p_account text,p_generation bigint,p_key text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  -- Row lock serializes against disconnect/generation changes. Same source is
  -- reserved once; a crash leaves a reservation for reconciliation, not replay.
  perform 1 from public.gmail_account_vault where owner_id=p_owner and account_id=p_account
    and generation=p_generation and status='active' for update;
  if not found then return false; end if;
  insert into public.gmail_ingest_reservations(owner_id,account_id,source_key,generation)
    values(p_owner,p_account,p_key,p_generation) on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.gmail_claim_source(uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.gmail_claim_source(uuid,text,bigint,text) to service_role;
