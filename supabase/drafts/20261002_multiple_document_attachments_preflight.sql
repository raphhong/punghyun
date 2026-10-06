-- DRAFT read-only inventory. NOT RUN. Execute only with explicit authorization.
-- No customer identities, tokens, file names/paths, or document contents returned.
begin read only;
select name, to_regclass('public.' || name) as relation from
  (values ('customers'), ('customer_documents'), ('customer_document_attachments'), ('admins'), ('sales_agents')) t(name);
select table_name, column_name, data_type, is_nullable from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'customers' and column_name in ('id', 'sales_agent_id', 'share_token_expires_at'))
  or table_name in ('customer_documents', 'customer_document_attachments'))
order by table_name, ordinal_position;
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where (schemaname = 'storage' and tablename = 'objects')
  or (schemaname = 'public' and tablename in ('customers', 'customer_documents', 'customer_document_attachments'))
order by schemaname, tablename, policyname;
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'customer-docs';
select count(*) as customer_rows from public.customers;
select count(*) as legacy_rows,
  count(*) filter (where checked) as checked_rows,
  count(*) filter (where file_path is not null and btrim(file_path) <> '') as file_pointers,
  count(*) filter (where file_path is not null and btrim(file_path) <> ''
    and device_id is null and left(doc_key, 13) <> 'device_photo_') as eligible_backfill_rows,
  count(*) filter (where device_id is not null or left(doc_key, 13) = 'device_photo_') as excluded_device_rows,
  count(*) filter (where split_part(file_path, '/', 2) = 'attachments') as reserved_legacy_pointers
from public.customer_documents;
select count(*) as conflicting_legacy_paths from (
  select file_path from public.customer_documents where file_path is not null and btrim(file_path) <> ''
  group by file_path having count(*) > 1
    and bool_or(device_id is null and left(doc_key, 13) <> 'device_photo_')
) conflicts;
select count(*) as object_metadata_rows,
  count(*) filter (where split_part(name, '/', 2) = 'attachments') as reserved_namespace_rows
from storage.objects where bucket_id = 'customer-docs';
-- Metadata coverage only; this cannot establish that actual Storage bytes exist.
select count(*) as legacy_pointers_without_object_metadata
from public.customer_documents d where d.file_path is not null and btrim(d.file_path) <> ''
  and not exists (select 1 from storage.objects o where o.bucket_id = 'customer-docs' and o.name = d.file_path);
select c.relname, c.relrowsecurity, r.rolname,
  has_table_privilege(r.rolname, c.oid, 'SELECT') as can_select,
  has_table_privilege(r.rolname, c.oid, 'INSERT') as can_insert,
  has_table_privilege(r.rolname, c.oid, 'UPDATE') as can_update,
  has_table_privilege(r.rolname, c.oid, 'DELETE') as can_delete
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')
  and ((n.nspname = 'public' and c.relname in ('customers', 'customer_documents', 'customer_document_attachments'))
    or (n.nspname = 'storage' and c.relname = 'objects')) order by c.relname, r.rolname;
rollback;
