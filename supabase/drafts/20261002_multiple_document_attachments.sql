-- DRAFT ONLY. NOT APPLIED. Review docs/MULTIPLE_DOCUMENT_ATTACHMENTS.md first.
-- Apply only under an explicitly approved, paused rollout after fresh backups,
-- policy inventory, and a successful staging rehearsal. No Storage bytes move.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Serialize old writers with the backfill/trigger installation. A maintenance
-- pause is still required: Storage API byte operations are not this transaction.
lock table public.customers, public.customer_documents in share row exclusive mode;

do $preflight$
declare
  p record;
  expected_cmd text;
  normalized_qual text;
  normalized_check text;
begin
  if to_regclass('public.customer_document_attachments') is not null then
    raise exception 'Attachment table already exists; reconcile migration history, do not rerun blindly';
  end if;
  if to_regprocedure('public.is_admin(uuid)') is null
     or to_regprocedure('public.customer_in_my_subtree(uuid)') is null then
    raise exception 'Approved admin/subtree authorization helpers are required';
  end if;
  if exists (select 1 from pg_attribute a
    where a.attrelid = 'public.customers'::regclass and a.attname = 'share_token_expires_at'
      and not a.attisdropped and (a.atttypid <> 'timestamptz'::regtype or a.attnotnull)) then
    raise exception 'Existing share_token_expires_at must be nullable timestamptz';
  end if;
  if not exists (select 1 from storage.buckets where id = 'customer-docs' and not public) then
    raise exception 'Existing customer-docs bucket must be private';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'Storage object RLS must already be enabled';
  end if;

  -- Deliberately fail closed for ALL unknown object policies, even those that
  -- appear to serve another bucket. OR-combined permissive policies cannot be
  -- safely classified by substring matching. Inventory and review them first.
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') <> 4 then
    raise exception 'Unreviewed Storage policy inventory; expected exactly the four repository baseline policies';
  end if;
  for p in select * from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    expected_cmd := case p.policyname
      when 'authenticated read docs' then 'SELECT'
      when 'authenticated write docs' then 'INSERT'
      when 'authenticated update docs' then 'UPDATE'
      when 'authenticated delete docs' then 'DELETE' end;
    normalized_qual := regexp_replace(coalesce(p.qual, ''), '[[:space:]()]', '', 'g');
    normalized_check := regexp_replace(coalesce(p.with_check, ''), '[[:space:]()]', '', 'g');
    if expected_cmd is null or p.cmd <> expected_cmd or p.permissive <> 'PERMISSIVE'
       or p.roles <> array['authenticated']::name[]
       or normalized_qual <> (case when expected_cmd = 'INSERT' then '' else 'bucket_id=''customer-docs''::text' end)
       or normalized_check <> (case when expected_cmd = 'INSERT' then 'bucket_id=''customer-docs''::text' else '' end) then
      raise exception 'Unreviewed Storage policy definition: %', p.policyname;
    end if;
  end loop;

  if exists (
    select file_path from public.customer_documents
    where file_path is not null and btrim(file_path) <> ''
    group by file_path having count(*) > 1
      and bool_or(device_id is null and left(doc_key, 13) <> 'device_photo_')
  ) then
    raise exception 'Legacy path is shared by multiple document rows; reconcile without copying, overwriting, or guessing ownership';
  end if;
  if exists (select 1 from public.customer_documents
    where file_path is not null and split_part(file_path, '/', 2) = 'attachments') then
    raise exception 'Reserved attachment namespace is already referenced by legacy rows';
  end if;
  if exists (select 1 from storage.objects
    where bucket_id = 'customer-docs' and split_part(name, '/', 2) = 'attachments') then
    raise exception 'Reserved attachment namespace already has objects; reconcile before rollout';
  end if;
  if exists (select 1 from public.customer_documents
    where file_path is not null and btrim(file_path) <> ''
      and device_id is null and left(doc_key, 13) <> 'device_photo_'
      and (right(file_path, 1) = '/' or btrim(doc_key) = '' or btrim(category) = '')) then
    raise exception 'Legacy metadata has an empty filename/key/category; reconcile before rollout';
  end if;
end;
$preflight$;

-- NULL intentionally preserves already-issued non-expiring links.
alter table public.customers add column if not exists share_token_expires_at timestamptz default null;

-- Keep this exact key/category allowlist aligned with ALL_DOCS in pipeline.ts.
-- Internal purchase-intent and transaction keys never pass this function.
create function public.customer_attachment_shared_category(p_doc_key text)
returns text language sql immutable parallel safe set search_path = pg_catalog as $fn$
  select case
    when p_doc_key in ('business_registration', 'corporate_registration', 'medical_license', 'rep_id',
      'card_sales_6m', 'tax_payment_cert', 'income_cert_2y') then 'screening_2'
    when p_doc_key in ('device_nameplate', 'device_photos', 'damage_photos', 'device_list_excel') then 'screening_3'
    else null end;
$fn$;
revoke all on function public.customer_attachment_shared_category(text) from public, anon;
grant execute on function public.customer_attachment_shared_category(text) to authenticated, service_role;

create table public.customer_document_attachments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  doc_key text not null check (btrim(doc_key) <> '' and left(doc_key, 13) <> 'device_photo_'),
  category text not null check (btrim(category) <> ''),
  file_path text not null unique check (btrim(file_path) <> ''),
  original_name text not null check (btrim(original_name) <> ''),
  size_bytes bigint check (size_bytes > 0 and size_bytes <= 20971520),
  content_type text,
  source text not null check (source in ('admin', 'sales', 'public', 'legacy')),
  state text not null default 'pending' check (state in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_at timestamptz,
  deleted_at timestamptz,
  storage_etag text,
  storage_version text,
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  check (source = 'legacy' or (size_bytes is not null and content_type is not null)),
  check (source = 'legacy' or file_path ~ (
    '^' || customer_id::text || '/attachments/' || id::text || '\.(pdf|jpg|jpeg|png|webp|gif|heic|heif|doc|docx|xls|xlsx|hwp|hwpx|txt|csv|zip)$')),
  check (source <> 'legacy' or split_part(file_path, '/', 2) <> 'attachments'),
  check (source not in ('sales', 'public') or
    (public.customer_attachment_shared_category(doc_key) is not null
      and category = public.customer_attachment_shared_category(doc_key))),
  check (state <> 'ready' or source = 'legacy' or uploaded_at is not null)
);
create index customer_document_attachments_customer_key_idx
  on public.customer_document_attachments (customer_id, doc_key, created_at, id);
create index customer_document_attachments_active_idx
  on public.customer_document_attachments (customer_id, doc_key) where state = 'ready' and deleted_at is null;

-- CHECKLIST STATE REMAINS SOLELY IN customer_documents.checked. No file count,
-- upload, removal, or trigger changes that flag or its unique(customer_id,key).
alter table public.customer_document_attachments enable row level security;
revoke all on public.customer_document_attachments from public, anon, authenticated, service_role;
grant select on public.customer_document_attachments to authenticated;
grant select, insert, update on public.customer_document_attachments to service_role;
create policy attachment_admin_read on public.customer_document_attachments
  for select to authenticated using (public.is_admin(auth.uid()));
create policy attachment_agent_read on public.customer_document_attachments
  for select to authenticated using (
    state = 'ready'
    and public.customer_attachment_shared_category(doc_key) = category
    and exists (select 1 from public.customers c
      where c.id = customer_document_attachments.customer_id
        and public.customer_in_my_subtree(c.sales_agent_id))
  );
-- Tombstone metadata is readable in the same scope so legacy merge suppression
-- works; actual object reads below require deleted_at IS NULL.

create function public.guard_customer_attachment_identity()
returns trigger language plpgsql set search_path = pg_catalog as $fn$
begin
  if (new.id, new.customer_id, new.doc_key, new.category, new.file_path, new.original_name, new.source, new.created_at)
    is distinct from
    (old.id, old.customer_id, old.doc_key, old.category, old.file_path, old.original_name, old.source, old.created_at) then
    raise exception 'Attachment identity is immutable; create a new upload';
  end if;
  if old.state = 'ready' and new.state <> 'ready' then
    raise exception 'Ready attachments cannot return to pending';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$fn$;
revoke all on function public.guard_customer_attachment_identity() from public, anon, authenticated, service_role;
create trigger customer_attachment_immutable_identity before update on public.customer_document_attachments
  for each row execute function public.guard_customer_attachment_identity();

-- SECURITY DEFINER is needed because approved old admin clients can still write
-- the checklist. The function only inserts the same NEW row's pointer, has no
-- dynamic SQL, and never changes/deletes an existing attachment or any object.
create function public.archive_customer_document_pointer()
returns trigger language plpgsql security definer set search_path = pg_catalog as $fn$
begin
  if new.file_path is not null and split_part(new.file_path, '/', 2) = 'attachments' then
    raise exception 'New attachment paths must not be written into the legacy checklist';
  end if;
  if new.file_path is not null and btrim(new.file_path) <> ''
    and new.device_id is null and left(new.doc_key, 13) <> 'device_photo_' then
    if exists (select 1 from public.customer_document_attachments a
      where a.file_path = new.file_path
        and (a.customer_id, a.doc_key, a.category) is distinct from (new.customer_id, new.doc_key, new.category)) then
      raise exception 'This file path already belongs to a different attachment';
    end if;
    insert into public.customer_document_attachments
      (customer_id, doc_key, category, file_path, original_name, source, state, uploaded_at)
    values (new.customer_id, new.doc_key, new.category, new.file_path,
      regexp_replace(new.file_path, '^.*/', ''), 'legacy', 'ready', new.uploaded_at)
    on conflict (file_path) do nothing; -- Never reset tombstones or overwrite history.
    -- Recheck after ON CONFLICT has waited for any concurrent owner to commit.
    if exists (select 1 from public.customer_document_attachments a
      where a.file_path = new.file_path
        and (a.customer_id, a.doc_key, a.category) is distinct from (new.customer_id, new.doc_key, new.category)) then
      raise exception 'This file path already belongs to a different attachment';
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function public.archive_customer_document_pointer() from public, anon, authenticated, service_role;
create trigger archive_customer_document_pointer after insert or update on public.customer_documents
  for each row execute function public.archive_customer_document_pointer();

-- BACKFILL BEGIN: exact paths and original uploaded_at; metadata only.
insert into public.customer_document_attachments
  (customer_id, doc_key, category, file_path, original_name, source, state, uploaded_at)
select customer_id, doc_key, category, file_path, regexp_replace(file_path, '^.*/', ''),
  'legacy', 'ready', uploaded_at
from public.customer_documents
where file_path is not null and btrim(file_path) <> ''
  and device_id is null and left(doc_key, 13) <> 'device_photo_'
on conflict (file_path) do nothing;
-- BACKFILL END

-- Stable SECURITY DEFINER helpers avoid RLS recursion and apply explicit actor
-- scope. Callers receive a boolean only, never document fields or contents.
create function public.can_read_customer_document_object(p_name text)
returns boolean language sql stable security definer set search_path = pg_catalog as $fn$
  select case
    when exists (select 1 from public.customer_document_attachments a where a.file_path = p_name) then
      exists (select 1 from public.customer_document_attachments a
        join public.customers c on c.id = a.customer_id
        where a.file_path = p_name and a.state = 'ready' and a.deleted_at is null
          and (public.is_admin(auth.uid()) or
            (public.customer_attachment_shared_category(a.doc_key) = a.category
              and public.customer_in_my_subtree(c.sales_agent_id))))
    when split_part(p_name, '/', 2) = 'attachments' then false
    when public.is_admin(auth.uid()) then true
    else exists (select 1 from public.customer_documents d
      join public.customers c on c.id = d.customer_id
      where d.file_path = p_name and public.customer_in_my_subtree(c.sales_agent_id)
        and (public.customer_attachment_shared_category(d.doc_key) = d.category
          or left(d.doc_key, 13) = 'device_photo_')) end;
$fn$;
create function public.customer_document_object_is_retained(p_name text)
returns boolean language sql stable security definer set search_path = pg_catalog as $fn$
  select split_part(p_name, '/', 2) = 'attachments'
    or exists (select 1 from public.customer_document_attachments a where a.file_path = p_name);
$fn$;
revoke all on function public.can_read_customer_document_object(text),
  public.customer_document_object_is_retained(text) from public, anon;
grant execute on function public.can_read_customer_document_object(text),
  public.customer_document_object_is_retained(text) to authenticated, service_role;

-- No Storage object INSERT/UPDATE/DELETE occurs in this migration. Bucket
-- limits apply to future uploads, never transform existing larger/other files.
update storage.buckets set public = false, file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/x-hwp', 'application/haansofthwp', 'application/hwp+zip', 'application/vnd.hancom.hwpx',
    'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed'
  ] where id = 'customer-docs';

drop policy "authenticated read docs" on storage.objects;
drop policy "authenticated write docs" on storage.objects;
drop policy "authenticated update docs" on storage.objects;
drop policy "authenticated delete docs" on storage.objects;
create policy "attachment scoped read docs" on storage.objects for select to authenticated
  using (bucket_id = 'customer-docs' and public.can_read_customer_document_object(name));
-- Only legacy admin/device writes remain eligible for session-role access.
-- Sales/public actions use the already-authorized service-role server path.
create policy "attachment legacy admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'customer-docs' and public.is_admin(auth.uid())
    and not public.customer_document_object_is_retained(name));
create policy "attachment legacy admin update" on storage.objects for update to authenticated
  using (bucket_id = 'customer-docs' and public.is_admin(auth.uid())
    and not public.customer_document_object_is_retained(name))
  with check (bucket_id = 'customer-docs' and public.is_admin(auth.uid())
    and not public.customer_document_object_is_retained(name));
create policy "attachment legacy admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'customer-docs' and public.is_admin(auth.uid())
    and not public.customer_document_object_is_retained(name));

-- Restrictive guards also fence any later-added permissive policy. Service
-- role bypass is intentional for short-lived, server-authorized signed uploads.
create policy "attachment read fence" on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'customer-docs' or public.can_read_customer_document_object(name));
create policy "attachment insert fence" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'customer-docs' or not public.customer_document_object_is_retained(name));
create policy "attachment update fence" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'customer-docs' or not public.customer_document_object_is_retained(name))
  with check (bucket_id <> 'customer-docs' or not public.customer_document_object_is_retained(name));
create policy "attachment delete fence" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'customer-docs' or not public.customer_document_object_is_retained(name));

comment on table public.customer_document_attachments is
  'Additive retained document metadata. Service-role append/finalize/tombstone only; never automatically purge Storage.';
commit;
