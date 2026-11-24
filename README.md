# Backend

## Manual WhatsApp Channel digest

Administrators can prepare daily posts at **Admin > WhatsApp digest**. The
read-only `GET /api/admin/whatsapp-digest?date=YYYY-MM-DD&limit=20` endpoint returns
currently public, available jobs first added on that calendar day in
`Asia/Kolkata`. It defaults to today and 20 jobs, accepts 1–50 jobs, and splits
text at complete job boundaries into posts of at most 3,500 characters. The
response is administrator-only and uncached. The existing public visibility,
location, category and availability rules apply when the digest is generated.

An administrator reviews, optionally edits and copies each post, then pastes and
sends it in the official WhatsApp app. This feature does not connect a WhatsApp
account, send messages, schedule publication or require a paid messaging API.
Draft edits remain in the current screen and are replaced on regeneration or
navigation. `date` refers to addition to Jobverify, not the employer posting date.

Validate with `node --test test/whatsappDigest.test.js test/whatsappDigestHttp.test.js`.

## Member assistant

The floating member assistant uses an injected Cloudflare `AI` binding. Ordinary
Node deployments have no adapter and report it disabled. Admins enable or disable it for all users from Admin Overview. The setting is
stored in global site settings and defaults to disabled; no environment flag or
redeployment is needed. Worker configuration keeps `JOB_VERIFICATION_ENABLED=false`.
See [assistant operation and rollout](workers/api/ASSISTANT.md).

Authenticated, uncached endpoints use the existing API envelope:

- `GET /api/assistant/capabilities`: `{ enabled, verificationEnabled }`.
- `POST /api/assistant/messages`: `{ message, history }` to
  `{ reply, jobs, sources, actions }`. Existing CSRF protection applies.

Each accepted turn makes one model call selecting `lookup_help` or `search_jobs`.
Approved help and shared public search provide the displayed facts and links.
Malformed operations ask for clarification. Search returns at most five cards;
Premium denial is a successful assistant reply, avoiding the client's HTTP 403
retry. Chat history never goes into application storage, logs or analytics.

Run focused checks with:

```sh
node --test test/assistantService.test.js test/assistantApi.test.js test/jobSearchService.test.js test/jobSearchSurface.test.js
```

`npm run assistant:evaluate` evaluates fifteen synthetic questions against the
live Workers AI model and fixed in-memory jobs, without production member or
database access. Supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the
environment. It checks the subscription, expected operations/effective filters,
approved answers and card/link provenance; failures exit nonzero. Run explicitly
in CI or an operator terminal. It is never a request-time fallback.

Run `npm run knip` to report unused files, exports, and dependency declarations.
Knip is pinned in the development dependencies and installed with `npm ci`.
The configuration also includes the `workers/gmail-relay` package.

Scraper scripts, catalogs, providers, and fallback modules are explicit entry
points because operational tooling discovers them by path or reads their source.
Named/default export aliases on scraper entry modules are intentional. Archived
reports are excluded from findings; unresolved imports and other remaining
findings stay visible for review.
