# Explicit cloud cashflow writes

## What changes

- Customer detail has a separate finance editor: edit → review before/after → final save. Cancel, navigation and ordinary autosave never post financial events.
- Full per-installment dates and integer-KRW amounts share one resolver across detail, dashboard and cashflow. The confirmed contract total must equal the installment sum; one-won final-installment differences are preserved.
- Actual funding and receipts are explicit, dated events. Status flags, contract purchase price and historical paid_count do not generate money. No maturity principal recovery, inferred contract start/end, automatic funding classification or customer seed rows.
- Two server-only RPCs require existing admin membership. Public/anonymous/authenticated roles cannot execute them or write ledger tables. The application independently authenticates and checks membership before constructing its existing server-only client.
- A single PostgreSQL transaction serializes customer edits, verifies the complete finance snapshot, detects duplicate evidence/events and writes the profile/schedule/movement plus before/after audit. Editing preserves movement ID, original source reference and category/basis. An uncertain response retries the same request ID and immutable payload.
- A present legacy receipt_ledger blocks schedule/receipt edits pending reconciliation. It remains authoritative for cashflow projection; parallel movements are not added again. Existing legacy completion labels remain distinguished from dated receipts.

## Deployment gate (not an automatic migration)

The SQL in `supabase/drafts/20261002_cashflow_writes.sql` is a draft. Do not run the older table-creation draft against existing tables. Do not deploy as complete until the following live checks are verified:

1. Verify the actual project and main commit. Inspect table columns/types, constraints, indexes, RLS and grants for customers, admins, cashflow_profiles and cashflow_movements. In particular check whether payment_schedule already exists, whether receipt_ledger exists, and whether earlier independent ledger work conflicts.
2. Record a private read-only fingerprint and count of every existing cashflow row before applying anything. Keep customer IDs and financial data outside GitHub. Verify the same historical records after migration and after each authorized event write.
3. Check only whether NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exist in the server deployment environment. Never display, copy, commit, rotate or generate key values. Missing credentials or new persistent access require the appropriate user approval/handoff.
4. Review and authorize the additive migration: one optional JSONB customer column, one new audit table, validation/snapshot helpers and two tightly scoped service-role-only functions. It does not change existing rows, original table grants, RLS policies or user membership. Any incompatible live schema needs a new reviewed migration, not a blind retry.
5. Apply the reviewed SQL as one transaction. Verify RPC execute grants: only the existing service_role server can invoke the new API. No public or authenticated table-write grants should be added. Check audit table permissions separately.
6. Build/deploy the exact reviewed commit only with deployment authorization. Test anonymous, ordinary sales and failed admin lookup against the deployed server. Use authorized synthetic/staging inputs for mutation tests, not invented live financial events.
7. Reconcile each authorized live record against its current UUID, original evidence reference, dates and amounts. Read before write; use the explicit UI or approved RPC path. Verify the saved event once in monthly and cumulative totals. Record schedules independently of actual receipts; do not add receipts without evidence.

## Checks

`npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

The transaction tests use the PGlite PostgreSQL engine with synthetic rows and real SQL, including rollback failures injected into movement/audit triggers, role ACLs, exact source preservation, idempotency and stale snapshots. This is not proof of production Supabase schema/permissions or multi-process production behavior. Hook-level UI interaction tests are separate from live browser QA. Report blocked or never-run stages explicitly.

Global lint currently has pre-existing CommonJS import violations in the three `build_*leaflet/profile.js` scripts. Do not change those unrelated files simply to hide the baseline. Production credentials are not required for isolated finance tests.
