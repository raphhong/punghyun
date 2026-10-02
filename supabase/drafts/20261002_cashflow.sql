-- Additive cashflow schema. Existing customer/payment records are not modified.
-- Run only after reviewing the target project and existing admins/is_admin setup.
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
  kind text not null check (kind in ('creditor_payment', 'securitization_inflow', 'funding_disbursement', 'rental_receipt')),
  basis text not null check (basis in ('planned', 'actual')),
  cash_date date,
  cash_month text check (cash_month ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'),
  installment_no integer check (installment_no between 1 and 600),
  amount bigint check (amount >= 0 and amount <= 9007199254740991),
  source_reference text not null unique,
  note text,
  recorded_at timestamptz not null default now(),
  check (length(trim(source_reference)) > 0),
  check (cash_date is null or cash_month is null or to_char(cash_date, 'YYYY-MM') = cash_month),
  check (kind <> 'rental_receipt' or (basis = 'actual' and installment_no is not null))
);
create index cashflow_movements_customer_date on public.cashflow_movements(customer_id, cash_date);
alter table public.cashflow_profiles enable row level security;
alter table public.cashflow_movements enable row level security;
revoke all on public.cashflow_profiles, public.cashflow_movements from anon, authenticated;
grant select on public.cashflow_profiles, public.cashflow_movements to authenticated;
create policy cashflow_profiles_admin_read on public.cashflow_profiles for select to authenticated using (public.is_admin(auth.uid()));
create policy cashflow_movements_admin_read on public.cashflow_movements for select to authenticated using (public.is_admin(auth.uid()));
-- rental_receipt links dated evidence to existing installments without incrementing paid_count.
-- A legacy receipt_ledger, if present, takes precedence; the two sources are not added.
-- Initial and residual disbursements are separate. Month-only evidence stays month-only.
-- No maturity principal recovery, guessed cash dates, default amounts, or seed rows.
commit;
