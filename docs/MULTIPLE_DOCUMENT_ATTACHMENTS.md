# Multiple document attachments: draft rollout and retention contract

## Status and scope

This is a **code-only, unexecuted database/Storage-policy draft**. No production
database was inspected or changed, no customer documents were opened, and no
objects were uploaded, copied, renamed, overwritten, or deleted for this work.
Applying the SQL, changing production policies, or deploying requires separate
approval. The SQL stays under `supabase/drafts/`; it is not an automatic migration.

No historical operational counts are used as deployment assertions or seed data.
Reconcile freshly authorized baseline counts and their precise definitions
immediately before an approved rollout.

## Data contract

- `customer_documents` remains the checklist, including its existing
  `UNIQUE(customer_id, doc_key)`, `checked`, device associations, file pointers,
  upload timestamps, and all existing rows. Presence and count of files do not
  change checklist state.
- `customer_document_attachments` is additive. Each new upload gets a UUID and
  a globally unique object path:
  `CUSTOMER_UUID/attachments/UPLOAD_UUID.EXT`. Selecting two identically named
  files produces two independent objects. Retries reuse the same upload ID.
- Attachment columns include customer/key/category, original filename, optional
  legacy size/MIME, `admin|sales|public|legacy` source, `pending|ready` state,
  created/updated/uploaded timestamps, nullable removal timestamp, and optional
  Storage ETag/version and SHA-256. Identity/path fields cannot be changed after
  insertion. Ready cannot revert to pending.
- Finalization verifies Storage metadata and file content in the server before
  publishing ready metadata. Pending uploads are not document evidence. The
  database alone cannot prove Storage bytes, MIME, a content hash, or file safety.
- Removal sets `deleted_at`; restoration clears it on that exact attachment.
  Neither operation deletes bytes or changes legacy rows. Tombstones participate
  in deduplication so a legacy pointer cannot resurrect a removed attachment.
- The customer foreign key is `ON DELETE RESTRICT`, not cascade. Any attachment,
  including pending and removed rows, retains its customer. The application must
  refuse customer deletion **before any Storage cleanup**; waiting for the FK
  error after cleanup is too late. This guard is required in every deletion flow.
- Service-role grants on the new table are SELECT/INSERT/UPDATE only, with no
  DELETE. There is no automatic purge, orphan cleanup, retention timer, or
  tombstone garbage collection. Those would need their own authorized design.

## Backfill and legacy writers

The backfill copies metadata only for a nonempty legacy `file_path` when
`device_id IS NULL` **and** `doc_key` does not start with `device_photo_`. Existing
device records, including older photos missing `device_id`, remain untouched.
The path and nullable uploaded time are copied exactly. The filename is derived
from the final path component; size/MIME/hash are left unknown, never invented.

An INSERT/UPDATE trigger archives newly referenced eligible legacy paths. It
does not replace prior attachments or update a matching row, and therefore does
not reset a tombstone. Re-running the backfill segment is idempotent. The full
migration deliberately refuses to rerun over an existing attachment table;
reconcile migration history instead. Shared paths with conflicting legacy
ownership, empty filename/key/category anomalies, and preexisting reserved
namespace paths are blockers rather than guessed repairs.

The trigger has `SECURITY DEFINER`, a fixed `pg_catalog` search path, fully
qualified table/function references, no dynamic SQL, and no client EXECUTE
grant. It can only append the legacy row's pointer. The immutable-identity
trigger does not use elevated rights. Apply under a trusted migration owner
with appropriate privileges; do not grant ownership to application roles.

Legacy checklist writes into the new `/attachments/` namespace are rejected,
including service-role writes. New uploads never update the old pointer. This
keeps old code from discovering new objects through a legacy row and deleting
them through that row. It does not make an unrestricted old server safe.

## Authorization and Storage policies

The draft requires the existing approved-admin helper and approved-agent subtree
helper. It does not redefine organization membership or broaden legacy table
RLS. The new table has no anon policy and no authenticated mutation grant.

- Admins can read attachment metadata for all customers
- Approved agents can read ready shared-document metadata only for their own
  customer subtree, using `customer_in_my_subtree`; pending agents and unrelated
  users see no rows
- Agent metadata includes tombstones within that scope for legacy merge
  suppression. Actual object access requires ready, not removed
- Sales/public writes are server-only and restricted to the exact `ALL_DOCS`
  key/category allowlist. Internal purchase-intent and transaction keys are not
  made visible by either attachment RLS or object read policies
- Public links use the server's token/customer validation, never anon table or
  Storage access. `share_token_expires_at timestamptz DEFAULT NULL` preserves
  existing non-expiring links; the app enforces a non-null expiry. No tokens are
  rotated and no expiry dates are backfilled

The existing repository's four authenticated Storage policies allow the entire
bucket. The draft replaces those exact reviewed policies with scoped reads and
admin-only legacy writes, plus restrictive fences protecting all new attachment
paths and all archived legacy paths from authenticated insertion/update/deletion.
The read fence limits agents to approved subtree/shared keys even if a future
permissive policy is accidentally added. Current device-photo keys remain
eligible for scoped legacy reads; their records are not migrated.

**Unknown policies abort the transaction.** The preflight requires exactly the
four baseline policy names, commands, roles, permissiveness, and expressions.
It deliberately rejects every additional Storage object policy, even one that
appears to target another bucket. Review the complete inventory; adapt the
allowlist and rehearse a reviewed variant when another bucket legitimately has
policies. Do not delete unknown policies simply to pass the check. Policies
combine with OR, so substring checks cannot establish safe access.

The existing private bucket gets a 20 MiB (`20 * 1024 * 1024`) per-file limit and
the application's MIME allowlist. These constraints affect future uploads,
including device uploads; existing bytes and object metadata are not rewritten
or purged. Test the actual supported browser MIME headers in staging. Existing
large or old-format files remain retained/readable in their authorized scope.

Service-role Storage calls and authorized signed-upload capabilities bypass
authenticated RLS by design. These SQL fences cannot stop a compromised service
key, an old service-role delete handler, or a still-valid signed URL. Keep signed
URLs short-lived, issue fresh ones only after checking actor/customer/document,
and never log tokens. Removing or expiring access cannot retract previously
issued download URLs; verify actual Storage token semantics and TTLs in staging.

## Compatibility and rollback

New readers merge both tables. A genuinely missing new table allows legacy
read-only fallback; unrelated database failures must stay visible. Uploads must
return a clear setup error before signing a URL when the new table is missing.
New attachment objects are never projected back into the one-file legacy column.

Old app versions can still read the old checklist and old current pointer, but
**cannot display all new attachments**. They also do not understand tombstones.
Rolling back to an old version can expose stale labels or broken links. Archive
metadata protects history references; it cannot preserve bytes if an old
service-role handler explicitly deletes those bytes. The historical sales/public
handlers used that privilege, so a completely unpatched old mutating app is not
a supported rollback target.

For rollback, pause uploads/removals/customer deletion first, retain the new
table, rows, triggers, customer-delete guard, bucket protections, and objects,
then deploy a read-compatible build or a read-only maintenance mode. Keep the
patched server authorization and deletion protections even if the UI is rolled
back. Do not drop the table/column, erase tombstones, reset permissions to broad
bucket access, move files back to legacy paths, or purge pending objects.
Investigate and correct forward. A destructive downgrade script is intentionally
not provided.

## Approved rollout checklist (not performed)

1. Get authorization for the target project, maintenance window, production
   metadata checks, schema/policy changes, and deployment. Confirm the actual
   backup/restore policy and create restorable DB plus Storage snapshots, because
   a database backup alone does not back up object bytes
2. Run the read-only draft
   `20261002_multiple_document_attachments_preflight.sql` only in that authorized
   project. Reconcile fresh customer/checklist/file-pointer/device counts,
   unique constraints, object metadata coverage, authorization helpers, table
   grants, bucket settings, and **all** Storage policies. The script outputs
   counts and schema/policy definitions, not customer names, tokens, or paths
3. Rehearse on an isolated staging project with synthetic customers and files.
   Review any extra policies rather than bypassing a preflight failure. Confirm
   installed Supabase Storage behavior, service-role privileges, signed upload
   replay/upsert behavior, MIME enforcement, object-info access, and signed
   download scopes with actual HTTP tests
4. Pause old and new upload/removal/customer-deletion flows, drain in-flight
   signed uploads, and prevent old browser sessions from invoking obsolete
   mutating actions. SQL table locks cannot serialize already-issued Storage
   byte uploads/deletes
5. Apply the reviewed transaction once with a trusted migration owner. A lock
   timeout or any assertion must roll back everything. Do not rerun a partially
   understood state; inspect the transaction outcome and migration history
6. Verify eligible backfill counts, exact path/timestamp mappings, unchanged
   legacy/customer/token/device rows, unchanged Storage object inventory, and
   negative authorization tests. Verify the existing customer unique constraint
   and checks remain. Reconcile mismatches before reopening writes
7. Deploy the compatible server/UI together, confirm every customer-deletion
   path checks all retained attachment states before cleanup, and reload the
   API schema cache if required by the deployed Supabase version
8. Smoke-test admin, own/subtree agent, unrelated agent, pending agent, public
   valid/expired token, and anonymous cases. Test multiple same-name files,
   retry/lost response, one failed file among successes, reload, reversible
   removal, and restore. Confirm internal docs never reach public/sales pages
9. Reopen writes only after reconciliation. Monitor errors without recording
   customer file contents, signed URLs, tokens, or credentials. Retain backups
   and the read-compatible rollback build according to the approved policy

## Local synthetic verification

Run `node --test tests/attachment-migration.test.mjs` after installing the declared
development dependencies (`@electric-sql/pglite` version range `^0.5.8`). The
suite creates fresh in-memory PostgreSQL fixtures, executes the draft SQL,
exercises real constraints/RLS/roles, and closes each database. It makes no
network requests and reads no production configuration or customer data.

Coverage includes unchanged legacy rows/object metadata/token values, device
exclusions, additive backfill, idempotent re-archive, tombstone preservation,
checklist independence, ID/path immutability, ready-state transitions, source
allowlists, customer deletion restrictions, role privileges, admin/subtree/
unrelated/pending/anon access, Storage read scopes, restrictive write fences,
MIME/key parity with application definitions, and atomic preflight failure.

PGlite verifies PostgreSQL behavior on synthetic data. It does **not** verify
production drift, deployed PostgREST schema caches, actual Supabase Storage
HTTP upload/signing semantics, object byte preservation, browser behavior,
multi-connection race timing, or backup recoverability. Those remain mandatory
staging/approved-rollout checks, not claims of this code-only deliverable.
