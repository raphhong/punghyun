-- Add only when absent. No customer values, receipt fields, policies or grants change.
-- Existing payment_schedule must already be jsonb; inspect before applying.
begin;
alter table public.customers add column if not exists payment_schedule jsonb;
commit;
