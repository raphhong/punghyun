# Cashflow data readiness

The dashboard is a read-only projection, not a reconciled bank balance or a data-entry system. A deployed page does not establish that every source is ready.

## Sources

| Measure | Required source | If absent |
| --- | --- | --- |
| Rental schedule | customers.first_payment_date, rental_months, rental_price; optional payment_schedule overrides | Missing or partial |
| Actual rental cash | customers.receipt_ledger entries with actual receivedDate and amount | Cannot infer from paid_count |
| Own vs securitized | cashflow_profiles.customer_id, funding_type | Unknown, never assumed own |
| Creditor payments and securitization inflows | cashflow_movements with kind, basis, cash_date, amount and unique source_reference | Unconfirmed, not zero/completed |
| Planned/actual disbursements | cashflow_movements.kind = funding_disbursement | Legacy purchase price and funding_done are reference only |

Initial payment and residual payment must be separate evidenced movements. Planned dates never become actual dates automatically. Maturity never creates principal recovery automatically. Unknown source data is hatched or marked '?' in charts; incomplete monthly net points are not connected.

## Schema and permissions

`supabase/drafts/20261002_cashflow.sql` proposes two new tables only. It does not alter or backfill customer/payment rows. Actual disbursement movements must be supported by evidence, not imported from contract totals. No default funding type, amount or cash date is provided.

Prerequisites: public.customers, public.admins and the existing public.is_admin(uuid) function from migration_sales_agents.sql. New tables enable RLS, revoke anon/authenticated access, then grant authenticated SELECT guarded by the existing administrator predicate. No client INSERT/UPDATE/DELETE grants are added. No existing role membership or existing policy is broadened.

If an earlier version of the draft was independently applied, do not rerun it blindly: inspect its constraints first, particularly whether funding_disbursement is an allowed kind. No draft was applied by this implementation.

The optional receipt_ledger belongs to the separately maintained payment-repair workflow; it is not created by this cashflow draft. Its adoption requires existing installment/receipt history reconciliation, duplicate protection and an audited write workflow. A paid_count flag is neither a dated receipt nor grounds to recreate a receipt without matching the existing record.

## Read-only diagnosis

Run `supabase/drafts/20261002_cashflow_diagnostics.sql` in the authorized project's Supabase Dashboard SQL Editor, or through its existing authenticated database administration connection. It reads catalog/schema/policy metadata only, not financial rows. Use the project configured by the deployment's NEXT_PUBLIC_SUPABASE_URL; do not substitute another project.

The admin UI distinguishes PGRST205/42P01 (table absent or not in schema cache), 42501 (permission denied), PGRST301/PGRST303 (session), missing-column codes, and other connection/query failures. Raw error messages and connection details are never exposed. An empty successful RLS query may mean no rows or no visible rows; it is not proof of zero cash.

No database administration connection is included with this repository. GitHub/Vercel code deployment access does not itself grant permission or connectivity to apply SQL or reconcile financial records.
