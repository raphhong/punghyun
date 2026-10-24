-- REVIEW ONLY. Do not apply without explicit new-auth-surface approval.
-- No refresh/access tokens or client secrets belong in this table.
create table if not exists public.gmail_oauth_pending (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  owner_id uuid not null,
  account_id text not null check (account_id ~ '^[a-z0-9_]{1,40}$'),
  binding_hash text not null check (binding_hash ~ '^[a-f0-9]{64}$'),
  verifier text not null check (verifier ~ '^[A-Za-z0-9_-]{43,128}$'),
  expires_at timestamptz not null
);
alter table public.gmail_oauth_pending enable row level security;
revoke all on public.gmail_oauth_pending from public, anon, authenticated;
grant all on public.gmail_oauth_pending to service_role;

create or replace function public.gmail_oauth_put(
  p_key text, p_owner uuid, p_account text, p_binding text, p_verifier text, p_expires timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize issuance for this owner; no unbounded accumulation from repeated starts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text, 0));
  delete from public.gmail_oauth_pending where expires_at <= pg_catalog.now();
  if p_expires <= pg_catalog.now() or p_expires > pg_catalog.now() + interval '11 minutes'
    or (select count(*) from public.gmail_oauth_pending where owner_id=p_owner) >= 5 then
    raise exception 'authorization unavailable';
  end if;
  insert into public.gmail_oauth_pending values(p_key,p_owner,p_account,p_binding,p_verifier,p_expires);
end;
$$;
create or replace function public.gmail_oauth_consume(p_key text, p_owner uuid, p_binding text)
returns table(owner_id uuid, account_id text, binding_hash text, verifier text, expires_at timestamptz)
language sql security definer set search_path = '' as $$
  delete from public.gmail_oauth_pending
  where key_hash=p_key and owner_id=p_owner and binding_hash=p_binding and expires_at>pg_catalog.now()
  returning owner_id,account_id,binding_hash,verifier,expires_at;
$$;
revoke all on function public.gmail_oauth_put(text,uuid,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.gmail_oauth_consume(text,uuid,text) from public, anon, authenticated;
grant execute on function public.gmail_oauth_put(text,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.gmail_oauth_consume(text,uuid,text) to service_role;
