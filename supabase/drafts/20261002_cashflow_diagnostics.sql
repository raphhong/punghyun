-- Read-only schema diagnostics. Run in the authorized Supabase project SQL Editor.
-- No financial rows or credentials are selected.
select name, to_regclass('public.' || name) as relation
from (values ('customers'), ('admins'), ('cashflow_profiles'), ('cashflow_movements')) t(name);
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'customers' and column_name in ('id','payment_schedule','receipt_ledger','execution_amount','funding_done','funding_done_date'))
    or table_name in ('cashflow_profiles','cashflow_movements'))
order by table_name, ordinal_position;
select tablename, policyname, roles, cmd, qual
from pg_policies where schemaname='public' and tablename in ('cashflow_profiles','cashflow_movements');
select c.relname, c.relrowsecurity,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('cashflow_profiles','cashflow_movements');
