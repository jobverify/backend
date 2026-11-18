# Move Jobverify's API from Render to Cloudflare Workers Free

This is a separate deployment target. `node server.js` and the existing GitHub workflows still use their normal Node implementations. The frontend and MongoDB remain where they are. Do not point production DNS at the Worker until the checks below pass.

## What this target runs

- Existing Express jobs, company, publishing, account, profile, saved-job, application-tracking, billing, Telegram-webhook and administrator routes.
- One SQLite-backed Durable Object owns the Express server and the Mongoose connection pool. MongoDB remains the system of record; SQLite stores only maintenance checkpoints.
- A Cron Trigger invokes maintenance once per minute: Telegram channel/group and personal alerts, alert fanout, GitHub pipeline reconciliation, resume-dispatch recovery, optional scraper scheduling, and hourly plan/hiring maintenance.
- Resume upload/storage/download and GitHub-based resume generation retain their existing routes. Extraction, model execution and compilation stay on the existing GitHub runner.
- Repository policy hashes, scraper-source names and the resume template are embedded at build time. Rebuild the API when those repository inputs change. Keep the API and GitHub runners on compatible source revisions.

GitHub pipeline logs and artifacts can be downloaded as a combined ZIP through the existing admin download buttons. Files stream one at a time without temporary files or whole-archive buffers. A private Durable Object fetch invocation retrieves each file, so sharded runs can include more than 50 upstream requests while staying on Workers Free. The internal file route is rejected by the public Worker entry point. GitHub credentials stay on `api.github.com`; signed storage requests receive no token. `manifest.json` lists completed downloads and expired/unavailable resources. Failed transfers may leave empty or partial ZIP entries; only entries listed in the manifest's `files` arrays completed. Downloads are limited to 2 GiB, 900 files, and 45 artifact-list pages per archive. Additional resources remain available directly from GitHub Actions.

The following require a Node runner and are unavailable on this target: local pipeline execution and local pipeline archive downloads, browser auto-apply, and job verification. `AUTO_APPLY_ENABLED`, `JOB_VERIFICATION_ENABLED` and `PIPELINE_LOCAL_ENABLED` must remain `false`; startup rejects enabling them. Existing verification reports are retained in MongoDB. No data is deleted.

Alert delivery is minute-based rather than the old 5/15-second loops. Personal delivery is intentionally limited to five queued records per maintenance pass, with a time budget; larger backlogs take additional passes. Existing schedule windows, retry rules and MongoDB claims still apply.

## Free plan constraints

Use **Workers Free**, including its free SQLite-backed Durable Objects. Do not enable Workers Paid, Containers, paid Queues or other paid products to follow this guide.

Current published limits include 100,000 Worker requests/day, a 3 MiB compressed script, and separate Durable Object quotas of 100,000 requests/day, 13,000 GB-seconds/day and 100,000 rows written/day. The minute trigger also consumes requests and storage operations. These quotas are shared with your other apps in the account. The Durable Object has a different CPU allowance from the thin forwarding Worker; this avoids putting password hashing in a plain Worker's 10 ms CPU budget. Quota exhaustion still causes errors until reset: free does not mean unlimited.

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [MongoDB integration](https://developers.cloudflare.com/workers/databases/third-party-integrations/mongodb/).

## 1. Install and check locally

Use Node 24.14+ in the 24.x line. Start in the backend repository (not the frontend).

```powershell
npm ci
cd workers/api
npm ci
npm test
npm run check
npm run test:runtime
npx wrangler login
```

`check` bundles the API, rejects native/browser execution dependencies and scripts over the free size limit, and runs a deployment dry run. `test:runtime` starts workerd locally using fake credentials and an unreachable test database; it checks startup, CORS and safe database failures. A separate local fixture streams a generated ZIP through private file fetching, Express, and a Durable Object without contacting GitHub. Neither command accesses your production database. A network connection may be needed to install the pinned tooling or for Wrangler's local metadata lookup.

`npm run dev` is available for local testing. If needed, copy `.dev.vars.example` to `.dev.vars` and supply **test** settings. Never commit `.dev.vars` or place backend secrets in any `VITE_` variable. The build output under `dist/` is generated and ignored.

## 2. Configure the Worker before changing DNS

Review `wrangler.jsonc`. Initial settings deliberately disable maintenance, Telegram sending and scraper scheduling, so previewing cannot send production alerts or start pipelines. Keep those disabled until cutover.

Set the three Turnstile values from your existing deployment. `TURNSTILE_EXPECTED_ACTION` must match your frontend's actual widget action; do not guess it. You may put the hostname list and action in `vars`; keep the secret key a secret binding.

The build does not inline `.env`. Backend configuration comes from Worker variables and secret bindings. Use the existing production values, especially **the same JWT secret**, MongoDB URI, publishing token and Telegram webhook secret.

The Worker is named `backend` in the `jobverify` account subdomain, so its initial deployment URL is `https://backend.jobverify.workers.dev`.

First create the Worker without any production domain attached:

```powershell
npm run deploy
```

Until required bindings are configured, requests return 503. This initial deployment has no production DNS effect. Then add the required secrets (each command prompts for the value):

```powershell
npx wrangler secret put MONGO_URI
npx wrangler secret put JWT_SECRET
npx wrangler secret put EMAIL_RELAY_URL
npx wrangler secret put EMAIL_RELAY_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put TURNSTILE_ALLOWED_HOSTNAMES
npx wrangler secret put TURNSTILE_EXPECTED_ACTION
```

Email delivery uses your existing HTTPS Gmail relay (`workers/gmail-relay`) on this target. SMTP environment variables are not used. Deploy/configure the relay first if it is not already working. Keep the relay origin and shared secret consistent on both sides.

Copy integration bindings that you currently use:

| Feature | Bindings to transfer |
| --- | --- |
| Google sign-in | `GOOGLE_CLIENT_ID` |
| Apple sign-in | Existing Apple configuration and signing/revocation secrets, unchanged |
| Publishing feeds and trusted frontend requests | `JOBVERIFY_PUBLISHING_TOKEN` and any other currently configured publishing credentials |
| GitHub pipeline dispatch and resume generation | `GITHUB_PAT`, `GITHUB_REPO`, `TAILORED_RESUME_GITHUB_REPO` if separate, and existing resume-workflow settings |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`; retain your existing bot username |
| Payments, if enabled in site settings | Existing `PAYMENT_PROVIDER`, Razorpay keys and webhook secret |

Add private values with `npx wrangler secret put NAME`; ordinary settings can be placed in `wrangler.jsonc` under `vars`. Do not set `NODE_OPTIONS` or `NODE_TLS_REJECT_UNAUTHORIZED`. `NODE_ENV=production`, `TRUST_PROXY=1` and the three disabled Node-only flags are already configured.

## 3. Confirm MongoDB connectivity

Use the existing Atlas database and TLS/authenticated URI. This migration does not copy collections or replace the database. Automatic collection/index creation is disabled in the Worker; use the existing database with its indexes. For a new database, provision/review indexes using the repository's Node migration/index tools first.

Workers do not provide one fixed outbound IP on the free plan. The old Render-only Atlas IP allowlist may therefore reject the new host. Check Atlas network access before cutover. Allowing `0.0.0.0/0` makes Atlas reachable from the public internet, so it is a security tradeoff, not a required code change: use a dedicated least-privilege database user, a strong unique password and verified TLS if you choose it. Cloudflare's published inbound proxy IP ranges are not a guaranteed outbound database allowlist.

Test the deployed Worker URL:

```powershell
curl.exe -i https://backend.jobverify.workers.dev/health
curl.exe -i https://backend.jobverify.workers.dev/ready
curl.exe -i https://backend.jobverify.workers.dev/api/site-settings
curl.exe -i https://backend.jobverify.workers.dev/api/jobs/snapshot
```

All four must return 200. Settings must have the current boolean `billingEnabled` and visibility values. Compare the snapshot with your database. `/health` alone does not prove Atlas is reachable. Use `npx wrangler tail` for safe error categories if readiness fails. Inspect Cloudflare analytics for CPU/memory errors too.

For authenticated browser testing before cutover, attach a same-site preview hostname such as `api-preview.jobverify.in` and use an isolated frontend preview with its API base set to that hostname. Configure its exact CORS origin and Turnstile hostname. The default `SameSite=Lax` cookies are for same-site hosts; an unrelated `workers.dev` address is not a valid production cookie test for `www.jobverify.in`.

## 4. Switch api.jobverify.in

1. Save the current `api.jobverify.in` DNS record and Render environment settings for rollback. Keep the old service configuration.
2. If `jobverify.in` is not already using Cloudflare DNS, add it on Cloudflare's free DNS plan and verify all existing frontend, mail/MX, SPF/DKIM and other records before changing nameservers.
3. In Workers & Pages, open `backend`, then Settings -> Domains & Routes -> Add -> Custom Domain, and enter `api.jobverify.in`. Resolve any existing Render CNAME conflict only for the `api` hostname; do not change `www` or mail records.
4. Confirm the custom domain's HTTPS certificate is active. Keep `PUBLIC_API_ORIGIN=https://api.jobverify.in` and the exact frontend origin allowlist.
5. Verify your frontend's production `VITE_API_BASE_URL` is `https://api.jobverify.in`. If it currently uses a Render hostname, change it and rebuild/redeploy the frontend. Check server-side publishing environment variables too.
6. Check `/ready`, `/api/site-settings`, `/api/jobs/snapshot` again using `https://api.jobverify.in`.
7. In a browser, test job search/filtering, login/logout, registration/verification/reset emails, saved jobs, profile and an admin page. If used, test Google/Apple sign-in, payments and a GitHub-dispatched resume job. Review the two baseline test failures listed below before relying on admin access.

Changing DNS alone does not resume a suspended Render service. This switch sends API traffic to the new Worker.

## 5. Enable background processing and Telegram

Stop/suspend the old Render instance's processing before enabling Cloudflare maintenance. Preserve your GitHub workflows: scrapers, rewriting, classification and resume model execution continue there, subject to GitHub's own account quotas.

Change the following values in `wrangler.jsonc`, then run `npm run deploy`:

```json
"CLOUDFLARE_MAINTENANCE_ENABLED": "true",
"TELEGRAM_ENABLED": "true"
```

Only set `SCRAPER_SCHEDULER_ENABLED=true` if you want the API to start scheduled pipelines, after transferring the GitHub credentials and verifying pipeline settings. Keep the three Node-only feature flags false.

If your existing Telegram webhook is already `https://api.jobverify.in/api/integrations/telegram/webhook` and the bot/secret are unchanged, its URL does not change. If it uses a Render hostname, re-register it with Telegram's `setWebhook`, setting the same `secret_token` as `TELEGRAM_WEBHOOK_SECRET`. Run this from a private local terminal or your existing webhook setup tooling: never paste a bot-token URL into a public ticket, browser screenshot or repository.

Wait for a minute tick and verify a controlled test alert, current quiet hours and the admin channel/group queues. Existing delivery receipts are retained; do not clear them to test migration. Observe maintenance logs, failures and backlog before increasing the personal-alert batch size.

## 6. Rollback

Disable `CLOUDFLARE_MAINTENANCE_ENABLED` and `TELEGRAM_ENABLED` in this config and redeploy first. Restore the saved API DNS record/frontend API setting, restore the old webhook URL if it changed, and re-enable the old backend only after its hosting limit is resolved. Render's suspended workspace is not a working fallback until that restriction clears. Keep MongoDB and its delivery receipts; restoring a database backup can cause already-sent alerts to be sent again.

## Validation performed in this workspace

The API bundle passed a Wrangler dry run and started in the real local Workers runtime. The platform tests cover proxy-header sanitization, maintenance deduplication/retries and disabled-feature validation. Telegram recovery tests cover the additional bounded-pass option, and the Mongo-backed personal/channel Telegram regressions passed.

### Deployment verified on November 17, 2026

The `backend` Worker is deployed at `https://backend.jobverify.workers.dev`. Its production bindings were transferred from the owner-provided production Render environment file; secret values are not stored in this document or the Worker source.

Live checks returned 200 for `/health`, `/ready`, `/api/site-settings`, `/api/jobs/snapshot`, `/api/jobs?limit=1`, and `/api/auth/csrf-token`. The settings response reported billing disabled and experienced jobs enabled. The snapshot reported 41,212 jobs across 1,440 companies at verification time. A preflight from `https://www.jobverify.in` returned the expected credentialed CORS headers; an untrusted origin received no CORS allowance.

Production API cutover completed on November 17, 2026. The Cloudflare zone is Active, and `api.jobverify.in` is an enabled Custom Domain for the `backend` Worker. The Vercel frontend and its existing DNS destinations are retained with DNS-only records. The Custom Domain is also recorded in `wrangler.jsonc`, so future deployments retain the mapping.

Live requests to `https://api.jobverify.in/health`, `/ready`, `/api/site-settings`, and `/api/jobs/snapshot` returned 200 over verified HTTPS. A Playwright browser smoke test loaded `https://www.jobverify.in/jobs`, rendered 12 job cards, and navigated to page 2, which rendered another 12 cards. Site settings, metadata, snapshots and both list-page requests returned 200, with no browser console warnings or errors. Account inspection showed only the zero-cost Cloudflare Free Plan.

Cloudflare maintenance, Telegram sending, and scraper scheduling remain disabled on this Worker. Keep the old Render service explicitly stopped before enabling background processing. Signed-in user sessions and integration delivery still need their controlled cutover checks; the public browser smoke test does not establish those.

Two existing API tests fail in this working tree: `app.test.js` expects 404 but receives 401 for a retired billing endpoint, and `siteSettings.test.js` expects 403 but receives 401 for an admin request. Both failures were reproduced with the original, pre-migration alert implementation. They are not fixed by this migration. The live deployment checks establish production Atlas connectivity. Actual user sessions, integration delivery, enabled background processing and CPU usage under production traffic still require the cutover checks above.

### Pipeline archive downloads restored on November 18, 2026

The production Worker now supports the existing admin logs/artifacts download buttons. The Worker adapter uses the Web Streams ZIP writer from the pinned `@zip.js/zip.js` dependency. The Node runner retains its existing implementation. Each GitHub file is retrieved through a private Durable Object fetch invocation; the public Worker rejects the internal file path before forwarding requests.

Validation passed: 12 Worker platform/download tests, 14 existing Node archive tests, two local workerd runtime tests, lint, build and deployment dry run. A temporary Worker on the same free account streamed a complete 129 MiB generated payload in a ZIP. The received payload size, ZIP directory, manifest and CRC32 were independently verified. A real Description Rewrite GitHub artifact (46,394 bytes, three entries) also downloaded successfully and passed CRC32 verification. The temporary Worker and its Durable Object namespace were removed after verification.

Production version `aa6b94ae-b268-403c-95a1-1442b3c1d617` is deployed to `backend.jobverify.workers.dev` and `api.jobverify.in`. Live health, database readiness, site settings, job snapshot and job-list requests returned 200. The private file route returned 404; an unauthenticated admin archive request returned 401. All 18 production secret bindings are retained, background flags remain disabled, and account inspection still shows only the zero-cost Cloudflare Free Plan. A signed-in browser retry remains the final owner check for the admin download button.
