# Job-link verification

The authenticated `/api/job-verifications` API investigates public job links using existing employer records and free sources. It does not use an LLM, paid search, browser automation, or execute page scripts. The frontend entry is **Verify a job** at `/verify-job`.

## Rollout

The feature defaults off. Set the backend environment variable `JOB_VERIFICATION_ENABLED=true` to enable submissions, queue processing and the navigation entry for the connected frontend. It is independent of billing. Public site settings expose the effective flag; frontend builds need no new environment variables or provider secrets.

Deploy the backend first. Before enabling traffic, preview the canonical identity backfill against the intended database:

```sh
node scripts/backfillVerificationKeys.js
```

After reviewing the counts, apply the additive indexes and backfill:

```sh
node scripts/backfillVerificationKeys.js --apply
```

The script never replaces original source/application URLs or public listing classifications. Repeating it leaves already-correct identity keys unchanged. New scraper upserts and document validation also refresh the lookup keys. Startup refuses enabled verification if required report indexes cannot be created. The unique active-owner index is part of the account-concurrency guarantee.

Deploy the frontend next and enable the server flag after the labelled fixtures and browser checks pass. Roll back by disabling the flag and restarting the backend. Existing reports remain private and readable through authenticated API requests and expire after their retention period; disabling the feature does not delete them.

## Contracts and limits

- `POST /api/job-verifications` accepts `{url, company?, title?}` and returns HTTP 202 with `data.id`, status and the saved report metadata. Public HTTP(S) links only; authentication/signed-link parameters are rejected. Company/title are lookup context, not proof.
- `GET /api/job-verifications/:id` returns only an unexpired report belonging to the current account. Invalid, missing, expired and other-owner IDs return the same 404.
- `GET /api/job-verifications?page=1` returns `data.items` and `data.pagination` in pages of 20.
- `DELETE /api/job-verifications/:id` deletes an owned report and releases its pending reservation. Workers cannot recreate deleted reports. Account deletion also removes the owner's reports.
- Existing cookie authentication, CSRF protection, ingress/mutation/read rate limits apply. Responses use `Cache-Control: no-store`; no report IDs or submitted URLs enter frontend analytics or browser storage.
- A shared Mongo budget permits 20 accepted checks per account per UTC day. Each account can have one active submission. Atomic reservations cap pending work at 100; two leased worker slots bound execution across replicas. Refused admission does not consume a daily check.
- Runs have a 60-second wall-clock deadline. Progress is persisted after each phase. Stale admissions and worker leases are recovered on later queue ticks, retaining completed evidence. Graceful shutdown aborts local work before stopping the queue timer.
- Reports expire after 30 days. Read queries enforce expiry immediately; Mongo TTL cleanup removes expired documents later. Cached public source data is separate from private reports.

Reports separate `sourceStatus`, `availability` and `risk`. User-facing verdicts are `official`, `matching`, `caution`, `high_risk`, or `inconclusive`. Every displayed reason references an evidence ID. Evidence includes fetch status, risk outcome, source URL, observation time, detail, and an optional excerpt. Cached source observations retain their original timestamp.

The frontend polls active reports every two seconds. Each read has a ten-second timeout. Transient failures retry the same report up to three times, after two, four and eight seconds (or a longer readable `Retry-After` interval). Reconnection never submits another investigation. While disconnected, progress is explicitly labelled as the last received update; prolonged outages offer a manual report retry. Permanent access/not-found errors stop polling, and navigation or account changes cancel pending requests and retries.

## Evidence and source boundaries

An exact role URL or requisition/ATS identity is required; title-only matches, conflicting identifiers and generic career-directory rows cannot confirm a vacancy. Existing employer records seed the search. Employer career sites must be refreshed over HTTPS, and hosted ATS tenants require an employer-to-tenant link (a board root is sufficient for tenant ownership, never vacancy identity). Greenhouse/Lever public job endpoints explicitly request JSON and must remain at the expected provider/tenant/role address after redirects. Other known employer sources use bounded passive page/Schema.org inspection. A matching repost never inherits official-publisher status.

The official Public Suffix List (ICANN and PRIVATE sections) is fetched and cached for domain parsing. Unknown suffixes or an unavailable current list fail closed; the implementation never guesses the last two labels. Wildcard and exception rules are covered by fixtures. Public-source requests validate all DNS answers, pin the connection address while retaining TLS hostname validation, revalidate every redirect, reject non-public destinations, and bound bytes, redirects and elapsed time. Reputation checks include the submitted, intermediate and final hosts; a legitimate final destination cannot erase an earlier threat finding. HTTP-only sources cannot provide authenticated official-source proof.

Phishing.Database is cached for up to 24 hours and checked locally. An unavailable or malformed feed cannot yield a clean result. RDAP registration age is supporting context only; old domains do not prove authenticity and young domains do not prove fraud. URLhaus is excluded: its current downloads require authentication, with separate commercial-use conditions. No source availability or accuracy SLA is promised by these free services.

## Validation and monitoring

```sh
node --test test/jobVerification*.test.js
node --test test/userAccountDeletion.test.js test/adminUserDeletion.test.js
```

In the frontend, run `npm test`, `npm run lint`, the isolated publishing build verifier, and `npm run test:e2e -- tests/e2e/job-verification.spec.js`. Browser fixtures cover source evidence, unavailable feeds, progress, history, errors, quota, deletion, account boundaries, desktop/mobile themes and keyboard focus. They make no live provider requests.

Production completion logs contain only verdict, duration and unavailable-check count, without URLs, report IDs, account IDs, page text or context. Track completion latency and provider failures from these aggregates. Incorrect-confirmation monitoring requires labelled fixture review and investigating user-reported cases; the system cannot infer ground truth from the absence of threat-feed matches. Before broad rollout, verify provider connectivity from the deployment environment and manually compare a small set of known official, reposted, expired and malicious examples against their cited sources.

Third-party source attribution is in [job-verification-notices.md](job-verification-notices.md).
