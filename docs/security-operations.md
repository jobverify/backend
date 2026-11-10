# Security remediation operations

Use `node backend/scripts/assembleRelease.js --output <new-directory>` from the
release parent to assemble both projects. The destination must not exist and
must be outside both source checkouts. Ship
only that result, after running `gitleaks dir <new-directory> --redact=100
--no-banner`. The assembler includes reviewed application directories, omits
environment files, caches, downloaded job data, tests and private storage, and
scans the final result. Its diagnostics contain paths and rule names only.
For the release gate, follow `.github/workflows/security.yml`: scan the backend
tree separately and apply the reviewed exact file/rule/value-hash exceptions
with `scripts/filterSecretScan.js`. Keep raw scanner output suppressed and remove
the temporary raw report; retain only the metadata report. A redacted ad hoc
scan can still report reviewed public values and model checksums.
Keep credentials in the deployment secret store; blank `.env.example` files are
safe distribution templates. Never zip the working directory as a release.

The supplied `backend.env` and downloaded Google OAuth client JSON were moved
reversibly to `../.secrets/` beside the backend checkout. Windows directory and
new file permissions preserve the workspace owner's access while restricting
inheritance. This is local containment, not a replacement for the deployment
secret manager. Backend startup still reads only backend-local configuration or
injected process environment; it does not load the quarantined files.

Provider rotation cannot be completed by editing this checkout. If the supplied
credentials crossed their intended audience boundary, rotate MongoDB credentials,
GitHub PAT, SMTP password, relay secret, Razorpay test secret, Telegram bot token
and webhook secret, Google OAuth client secret, and any reused JWT signing secret.
Stage replacements in the deployment secret store, verify dependent services,
then revoke predecessors and review provider audit logs. JWT rotation intentionally
invalidates existing sessions. Do not put replacement values in release files.

Drain old alert workers before deploying the paged outbox processor: old code
cannot interpret a partially paged receipt. Existing pending receipts initialize
their cursor/watermark automatically. Roll back only after draining new workers
and confirming there are no partially paged receipts; otherwise finish those
receipts with the new worker before reverting.

Use `npm run db:indexes:plan` in a separate process to review all model indexes.
Plan and `apply --dry-run` disable implicit collection/index creation. Explicit
apply still requires the existing acknowledgement and refuses production mode.
Use a reviewed database migration procedure for production unique/queue indexes.

Persisted historical bookmark duplicates can be repaired with
`node scripts/deduplicateSavedJobs.js` (plan), then `--apply` with
`JOBVERIFY_ACKNOWLEDGE_BOOKMARK_REPAIR=true` after a backup and
review. The migration preserves the first occurrence and runs atomically against
the current array; live save/remove operations also preserve set membership.

Backups and restore verification are provider operations. Confirm MongoDB
point-in-time recovery and retention in the owning account, export encrypted
snapshots with access separate from production writers, and test restoration to
an isolated database on a recurring schedule. Validate user/purchase linkage,
payment-provider reconciliation, unique indexes and outbox state before failover.
Never replay payment captures or external notification sends during restore
tests. Retain the preceding application image and schema compatibility notes for
rollback; deployment success alone does not prove a restorable backup.

CI selects the latest supported Node 24 patch. Upgrade deployed Node alongside
the npm dependencies: updating the npm Undici package does not update Node's
built-in fetch implementation. Re-run dependency audits for both the backend and
the Gmail relay worker whenever either lockfile changes.
