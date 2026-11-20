# Member assistant operation and rollout

The `AI` binding is passed to Express inside `JobverifyApi`; it is not a string
environment variable. The adapter uses only
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, with one inference per turn, at most 512
output tokens and a thirty-second turn deadline. There is no provider, gateway,
paid-model or retry fallback. Cloudflare job verification stays disabled.

Messages are limited to 2,000 characters, history to ten user/assistant text
messages and the complete raw JSON body to 24 KiB. Per-member limits are five
turns per minute and thirty per UTC day. Existing Mongo rate-limit documents
store counters, never conversation content. Quota, capacity and outage responses
include `retryAfterSeconds` in JSON; the browser requires an explicit retry.
Free allocation exhaustion waits until the next 00:00 UTC reset.

Workers Free includes 10,000 neurons daily shared across the Cloudflare account.
It stops serving inference when the allocation is exhausted. Do not upgrade the
account, configure AI Gateway credits, or add a paid fallback. Verify the account
subscription and monitor the Workers AI usage dashboard before enabling and
after rollout. Per-member quotas do not reserve capacity for every member.
See [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
and [model documentation](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/).

1. Keep `ASSISTANT_ENABLED=false` in `wrangler.jsonc`. Run backend lint and focused
   assistant/search tests, then `npm run check` and `npm run test:runtime` here.
   Run frontend lint, unit tests, production build and assistant Playwright cases.
2. Run `npm run assistant:evaluate` from the backend root with Cloudflare
   credentials supplied through the environment. Require all fifteen controlled
   cases to pass. Use only synthetic questions, never real transcripts.
3. Release backend and frontend with the flag off. Check health/readiness, public
   settings (`assistantEnabled:false`), guest rejection and authenticated
   capabilities (`enabled:false`). Preview desktop/mobile layouts, both themes,
   CSRF, search and help; confirm the account still has Workers Free at zero cost.
4. Set `ASSISTANT_ENABLED=true` and redeploy only after the preceding checks.
   Confirm current jobs and approved help, disabled verification, Premium denial
   with one inference, and correctly timed explicit quota retries. Public settings
   refresh on navigation/focus and every thirty seconds in open tabs.
5. Roll back by setting `ASSISTANT_ENABLED=false` and redeploying. The public gate
   unmounts the widget, clears its in-memory state and cancels pending display.
   No database rollback or migration is needed.

Cloudflare defers updates to an active Durable Object for up to five minutes by
default. Wait for the new settings and routes before declaring a deployment
verified. For an urgent disable, pass
`--durable-objects-code-update-mode immediate` to Wrangler to apply it immediately.
See [Durable Objects code updates](https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/).

Conversation state survives client-side navigation only. Reload, logout, account
revalidation/change and job visibility changes clear it. Requests carry session
and visibility guards so delayed results cannot reappear in a new session.
The privacy page describes Cloudflare processing. Keep transcripts out of error
reports, analytics, browser storage, database records and operational logs.
