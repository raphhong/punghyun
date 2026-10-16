# Initial actual funding entry

Customer detail now has an explicit actual funding ledger form. It records an already completed transfer; it does not initiate a transfer. The date, positive integer KRW amount, evidence and explicit confirmation are required. Dates use Asia/Seoul today. Inputs start blank; customer flags and execution_amount are not evidence.

Only the first actual funding record is supported. Existing actual funding records block additional/partial/residual entries. The stable `admin-initial-funding:v1:<customer UUID>` source reference is an application registration key, not a bank transaction identifier. Evidence and the authenticated administrator ID are stored in note JSON. Concurrent requests through this action use the same unique key and cannot append a second record. This is not a lock against unrelated external database writers using other keys.

Authentication, admins membership and customer access are checked using the session before the existing server-only service-role client is instantiated. No new key, grant, RLS policy or migration is introduced. Existing profiles are preserved by INSERT ON CONFLICT DO NOTHING; a missing profile is inserted with null funding_type and creditor_name. The movement is kind=funding_disbursement, basis=actual. Customers, rental schedules and receipt status are never updated.

## Deployment prerequisites

- Existing production `SUPABASE_SERVICE_ROLE_KEY` environment variable, server-side only.
- `cashflow_profiles`: customer_id UUID primary key referencing customers; funding_type and creditor_name nullable.
- `cashflow_movements`: id UUID default, customer_id FK to profiles, kind, basis, cash_date date, cash_month nullable, amount bigint, installment_no nullable, source_reference text UNIQUE, note text, recorded_at default. Existing checks must accept funding_disbursement/actual and the supplied amount.
- Existing administrators must be able to SELECT both tables for the cashflow screen; server role must already be able to SELECT and INSERT. Missing capability blocks the form/action; do not expand permissions automatically.

Profile insertion and movement insertion are separate operations. A failed movement can leave an empty/null profile; no destructive rollback is attempted. Any uncertain save/readback result requires refreshing and checking existing records before retrying. The UNIQUE source_reference constraint is required; there is no fallback insert if ON CONFLICT fails.

## Operator verification after deployment

Open customer detail, find 실제 집행원장, confirm there are no existing actual entries, enter the verified transfer date/amount/evidence and confirm once. Reload customer detail and the same month's cashflow. Verify one actual funding entry, correct monthly/cumulative funding, unchanged rental receipts, and unchanged/unknown source. Production records must be entered by the authorized operator; tests only use synthetic data.

The unrelated contract-date proposal is excluded. No production record or schema change is part of this code deployment.
