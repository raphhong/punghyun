-- Apply after the reviewed state and account-vault schema, in one transaction.
-- Credentials passed to these functions are AES-GCM envelopes only.
create table public.gmail_vault_operations (
  operation text primary key check(operation ~ '^[a-f0-9]{64}$'),
  owner_id uuid not null, account_id text not null,
  created_at timestamptz not null default now()
);
alter table public.gmail_vault_operations enable row level security;
revoke all on public.gmail_vault_operations from public,anon,authenticated;
grant all on public.gmail_vault_operations to service_role;
create function public.gmail_vault_save(p_operation text,p_owner uuid,p_account text,
 p_mailbox text,p_scope text,p_envelope jsonb,p_labels text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text || ':' || p_account,0));
 if p_scope <> 'https://www.googleapis.com/auth/gmail.readonly' or
   p_envelope->>'version' <> '1' or not (p_envelope ?& array['keyId','iv','tag','ciphertext']) then
   raise exception 'invalid credential envelope';
 end if;
 insert into public.gmail_vault_operations(operation,owner_id,account_id)
 values(p_operation,p_owner,p_account) on conflict do nothing;
 if not found then
   if not exists(select 1 from public.gmail_vault_operations where operation=p_operation and owner_id=p_owner and account_id=p_account) then
     raise exception 'operation mismatch';
   end if;
   return;
 end if;
 insert into public.gmail_account_vault(owner_id,account_id,mailbox,scope,envelope,status,label_ids)
 values(p_owner,p_account,p_mailbox,p_scope,p_envelope,'active',p_labels)
 on conflict(owner_id,account_id) do update set mailbox=excluded.mailbox,scope=excluded.scope,
 envelope=excluded.envelope,status='active',label_ids=excluded.label_ids,
 generation=public.gmail_account_vault.generation+1,updated_at=pg_catalog.now();
end; $$;
create function public.gmail_vault_disable(p_owner uuid,p_account text,p_mailbox text)
returns table(generation bigint,envelope jsonb)
language sql security definer set search_path='' as $$
 update public.gmail_account_vault set status='disabled',generation=generation+1,updated_at=pg_catalog.now()
 where owner_id=p_owner and account_id=p_account and mailbox=p_mailbox and status='active'
 returning generation,envelope;
$$;
create function public.gmail_vault_finish_disconnect(p_owner uuid,p_account text,p_generation bigint,p_result text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_result not in ('revoked','revoke_unconfirmed') then raise exception 'invalid result'; end if;
 update public.gmail_account_vault set status=p_result,
 envelope=case when p_result='revoked' then '{}'::jsonb else envelope end,updated_at=pg_catalog.now()
 where owner_id=p_owner and account_id=p_account and generation=p_generation and status='disabled';
 return found;
end; $$;
revoke all on function public.gmail_vault_save(text,uuid,text,text,text,jsonb,text[]) from public,anon,authenticated;
revoke all on function public.gmail_vault_disable(uuid,text,text) from public,anon,authenticated;
revoke all on function public.gmail_vault_finish_disconnect(uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.gmail_vault_save(text,uuid,text,text,text,jsonb,text[]) to service_role;
grant execute on function public.gmail_vault_disable(uuid,text,text) to service_role;
grant execute on function public.gmail_vault_finish_disconnect(uuid,text,bigint,text) to service_role;
