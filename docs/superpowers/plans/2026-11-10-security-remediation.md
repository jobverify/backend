# Security remediation implementation plan

Specification: the ten findings R01–R10 in the 2026-11-09 JobVerify remediation report, authorized for implementation by “fix all these”.

## Global constraints

- Preserve unrelated working-tree changes. Work in place on the existing release checkout; do not commit, push, or alter Git metadata.
- Never log credential values, use production credentials in tests, or contact external providers with them.
- Retain public API response contracts, paid entitlement integrity, deletion fences, and durable alert obligations.
- Add meaningful failing regression tests before fixes where feasible. Use disposable MongoDB for database concurrency and DDL checks.
- Record actual checks and any external work that cannot be completed from this checkout.

## Tasks

- [x] R02/R05: attach legacy job query promises immediately; validate safe offsets while preserving page 2001; bound public find, aggregate, count, distinct, and summary operations. Files: src/controllers/jobController.js, src/validation/requestValidators.js, src/services/jobDatasetSummaryService.js, focused test files.
- [x] R03: remove persistent expiry writes from authentication/profile reads; condition expiry writes on current database entitlement; preserve renewal and preference fields. Files: auth/user controllers, auth middleware, plan service, central expiry service, real Mongo race tests.
- [x] R08: canonicalize saved-job IDs; use atomic set insertion/removal; retain purge and owner fences. Files: user controller, deduplication migration, bookmark tests.
- [x] R06: disable automatic index/collection creation before planner model imports and on its connection; complete model registry; prove plan and dry-run perform no DDL. Files: scripts/indexes.js and integration tests.
- [x] R07: bounded, resumable alert recipient fanout (delegated independently; see task brief). Files: src/models/JobAlertOutbox.js, src/services/jobAlertOutboxService.js, src/services/jobAlertService.js, relevant alert tests.
- [x] R04: replace all three certificate bypasses with strict, bounded HTTPS fetching; preserve fixture injection and sentinel behavior. Files: affected scraper adapters, shared helper, scraper tests.
- [x] R01: move credential files into local private storage reversibly; add blank templates and an allowlisted assembled-release gate with redacted diagnostics. Test dummy credentials and safe examples. Document provider rotation as an external operation if inaccessible.
- [x] R09/R10: add semantic backend lint, scraper CI regression checks, patched Undici locks including relay worker, and worker dependency audit. Verify package changes without install scripts.
- [x] Run affected suites, lint, isolated integration tests and dependency audits; attempt the complete suites; inspect final scoped diff. Obtain one fresh read-only bypass/regression review and resolve confirmed issues. Record external rotation/deployment/backup limitations.
- [ ] Pass complete repository regression checks after restoring the 70 missing original fixture files and resolving the remaining extraction/classification assertions. The full API run finished with 115 failures; the duplicate aggregate run was stopped after confirming the same blockers. Tests remain enabled.

## Final targeted verification

The final affected suite passed 89/89 tests; isolated payment/database integration
passed 7/7. Semantic and syntax lint pass (170 existing style warnings). Both
complete dependency lockfile audits report zero vulnerabilities. Earlier
compatibility and strict-TLS checks passed 82/82; relay tests passed 36/36 and its
build dry-run succeeded. These results do not establish a green complete suite.

The final User save guard ignores implicit hydrated defaults throughout the
schema, including nested documents, while retaining explicit field and array
mutations. Real concurrency tests reproduced and then eliminated lost renewals,
bookmarks, verification state and preferences. Alert eligibility and its
transactional owner fence both retain users with an absent legacy deactivation
flag while excluding explicitly paused accounts. Retry backoff now counts failed
attempts separately from successful partial fanout claims.

## Review focus

Concurrent renewal versus expiry; duplicate and uppercase IDs; retried alert pages versus cleaned deliveries; account deletion and job purge; query failure while summary is pending; implicit DDL on connection; TLS redirects and bounds; secrets in the final artifact.
