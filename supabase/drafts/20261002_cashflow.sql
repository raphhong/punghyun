-- DRAFT ONLY. Not applied. Review in an isolated DB after migration_sales_agents.sql.
-- No existing customer, paid_count, payment_schedule or receipt_ledger is changed.
-- No guessed defaults, seed data, historical backfill, or client write grants.
begin;
create table public.cashflow_profiles (
  customer_id uuid primary key references public.customers(id) on delete restrict,
  funding_type text check (funding_type in ('own', 'securitized')),
  creditor_name text,
  check (funding_type is distinct from 'own' or creditor_name is null)
);
create table public.cashflow_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cashflow_profiles(customer_id) on delete restrict,
  kind text not null check (kind in ('creditor_payment', 'securitization_inflow', 'funding_disbursement')),
  basis text not null check (basis in ('planned', 'actual')),
  cash_date date, -- missing date stays missing, never now() or contract date
  amount bigint check (amount >= 0 and amount <= 9007199254740991),
  source_reference text not null unique, -- unique evidence/transaction ID prevents re-import
  note text,
  recorded_at timestamptz not null default now(),
  check (length(trim(source_reference)) > 0)
);
create index cashflow_movements_customer_date on public.cashflow_movements(customer_id, cash_date);
alter table public.cashflow_profiles enable row level security;
alter table public.cashflow_movements enable row level security;
revoke all on public.cashflow_profiles, public.cashflow_movements from anon, authenticated;
grant select on public.cashflow_profiles, public.cashflow_movements to authenticated;
create policy cashflow_profiles_admin_read on public.cashflow_profiles for select to authenticated using (public.is_admin(auth.uid()));
create policy cashflow_movements_admin_read on public.cashflow_movements for select to authenticated using (public.is_admin(auth.uid()));
-- Entries, reversals, reconciliation and write/audit workflow require business approval.
-- Actual rental receipts retain ONE source: customers.receipt_ledger when separately approved.
-- Funding retains ONE source: dated, evidenced funding_disbursement entries.
-- Initial payment and residual payment are separate entries. Contract totals and
-- legacy funding_done flags never backfill actual movements. No maturity recovery
-- is generated automatically.
commit;
