# LinkedIn and Instagram publishing

The publishing workflow, `.github/workflows/social-publisher.yml`, runs at **10:00 and 18:00 Asia/Kolkata** (`30 4,12 * * *` UTC). Each slot can publish one admin-approved job to each destination: a LinkedIn image post and an Instagram image post or Reel. An empty slot is a successful no-op.

GitHub orchestrates bounded API calls and exits. Cloudflare runs the provider requests; MongoDB holds approvals, immutable payload snapshots, leases and receipts. R2 holds the approved images, Reel video and cover. The publishing runner needs no MongoDB credential, platform token, npm installation, Postiz stack or persistent filesystem. The separate draft-rendering workflow is described below.

## Configure before deploying

1. Create the private R2 bucket **`jobverify-social-assets`** in the API worker's account before deploying the new R2 binding. Do not enable the bucket's public development URL. Images are served at `/api/social-assets/<sha256>.jpg` only after approval or use; unpublished previews require administrator authentication.
2. Generate a separate 32-byte base64 key, for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`, and save it as **`SOCIAL_TOKEN_ENCRYPTION_KEY`** using Cloudflare secrets. Keep a secure backup. Changing this key requires reconnecting both accounts; never reuse the Apple token encryption key.
3. Configure the following worker secrets/variables. Use `wrangler secret put NAME` for secrets from `workers/api`; do not commit their values.

| Name | Value |
| --- | --- |
| `SOCIAL_LINKEDIN_CLIENT_ID` / `SOCIAL_LINKEDIN_CLIENT_SECRET` | LinkedIn application credentials |
| `SOCIAL_LINKEDIN_ORGANIZATION_ID` | Numeric company Page ID, without the URN prefix |
| `SOCIAL_LINKEDIN_PAGE_NAME` | Optional Page display name |
| `SOCIAL_INSTAGRAM_CLIENT_ID` / `SOCIAL_INSTAGRAM_CLIENT_SECRET` | Instagram application credentials |
| `SOCIAL_INSTAGRAM_ACCOUNT_ID` | Instagram professional account `user_id`, not the app-scoped `id` |
| `SOCIAL_GITHUB_REPOSITORY_ID` | Immutable `id` from GitHub's `GET /repos/jobverify/backend` |
| `SOCIAL_GITHUB_OWNER_ID` | Immutable `owner.id` from that response |

The checked-in worker configuration fixes the repository name, OIDC audience, and supported API versions. Keep the exact audience `https://api.jobverify.in/api/social-publisher/run`. The identity check also requires `main`, this workflow path, the branch subject, and a `schedule` or `workflow_dispatch` event. Forks, PRs and other workflows are rejected.

4. Register these exact OAuth callback URLs:
   - LinkedIn: `https://api.jobverify.in/api/admin/social-accounts/linkedin/callback`
   - Instagram: `https://api.jobverify.in/api/admin/social-accounts/instagram/callback`
5. Obtain LinkedIn company Page access with **`w_organization_social` and `r_organization_social`**. The connecting member needs the appropriate Page role. Use Instagram Login for the configured professional account with **`instagram_business_basic` and `instagram_business_content_publish`**. Account ownership and app review requirements are provider prerequisites.
6. Run `npm run db:indexes:plan`, review it, then `npm run db:indexes:apply` against the intended database. This adds the social collections/indexes; it does not backfill jobs or create drafts automatically. Deploy backend and existing frontend changes through their normal release process.

## Pilot and enable

Publishing settings default to **paused**. The workflow also skips runs unless the repository variable **`SOCIAL_PUBLISHER_ENABLED=true`** is explicitly set. Preserve the backend repo's current visibility. Confirm this production use is permitted under [GitHub's Actions terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#actions) before enabling it. Private-repository usage shares the owner's [included compute allowance](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

In **Admin → Social publishing**:

1. Connect the fixed LinkedIn Page and Instagram account. Connection challenges expire after ten minutes and belong to the initiating administrator. Tokens are never returned to the browser.
2. Search for and select a currently public, classified, available job. Edit both captions. Both platform captions include the direct JobVerify job URL with platform-specific tracking.
3. Generate and upload the 1080 × 1350 JPEG. Review the returned stored image and both captions. Select a future 10:00 or 18:00 IST slot within 30 days, then approve.
4. For one explicitly approved pilot, enable the repository variable, unpause publishing, and manually dispatch the workflow during that slot's first fifteen minutes. Keep other slots empty until the pilot's receipts are verified. Then approve the normal daily queue.

Changing captions, job facts or images invalidates unsent approvals. Changing an account invalidates that destination's queued deliveries; other approved destinations can continue. The image is generated in the browser from factual fields and existing brand assets; no paid AI service is used. Unknown salary or experience is omitted. LinkedIn's transport text is escaped using its `little` format so the approved plain text is preserved.

## Failure handling

- Scheduling is best effort. A first claim arriving at least fifteen minutes late records missed deliveries rather than publishing a backlog. A batch claimed within that grace may finish later, within its ten-minute deadline. The workflow has an outer fifteen-minute timeout.
- Each continuation performs a bounded step and saves its result. Instagram processing polls at most once per minute, up to five checks, including failed HTTP checks. No new provider step starts after the batch deadline; a publish request already in flight keeps its lease until its bounded response finishes or the lease expires.
- Successful destinations are never sent again. After a partial failure, approve only the remaining destination for a future unused slot.
- A lost or ambiguous publish response becomes **uncertain**. Do not blindly retry. Use the admin reconciliation controls to verify a provider post ID, or, after the batch deadline and checking the destination, explicitly confirm that no post exists before rescheduling.
- Maintenance expires stale work, refreshes eligible tokens and performs read-only receipt reconciliation. It never creates or publishes posts. Instagram long-lived tokens are refreshed before expiry when eligible. LinkedIn refresh is used only when actually granted; otherwise reconnect before expiry. An expired or revoked token blocks that destination.
- Pause prevents new dispatches; an in-flight provider request can finish. Published snapshots and receipts remain retained. To roll back, pause in admin and set `SOCIAL_PUBLISHER_ENABLED=false`.

## Verification

Run `node --test test/social*.test.js`, the backend checks, the Cloudflare worker checks/runtime tests, frontend checks, and `tests/e2e/admin-social-publishing.spec.js`. Tests use an ephemeral Mongo replica set, in-memory image storage, and mocked provider HTTP responses. They do not publish live posts. Real app permissions, real account connections, and the explicit pilot remain deployment checks.

Provider references: [LinkedIn Posts](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [LinkedIn Images](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api), [LinkedIn text format](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format), [Instagram publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing), [Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Instagram media lookup](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/v21.0/).


## Automatic Instagram job Reel drafts

The admin saves publishing filters for JobVerify's Instagram account. Each finished draft covers one public, classified, available scraped job. Filters use the saved-job matching semantics; empty filters need explicit all-eligible-jobs opt-in. Generation targets four matching unapproved ready/reserved drafts and never creates another campaign for a previously used fingerprint.

`.github/workflows/social-video-drafts.yml` runs after successful trusted main-branch **Jobverify Post-scrape Classification** runs, at 09:00/17:00 IST (`30 3,11 * * *` UTC), or manually. It renders at most two jobs sequentially on Ubuntu 24.04, Python 3.12 and FFmpeg, with a 20-minute workflow timeout. The existing GitHub Actions production-use eligibility and compute-allowance prerequisite above also applies to rendering. Cron is best effort.

The repository variable `SOCIAL_VIDEO_DRAFTS_ENABLED=true` permits workflow execution; the independent admin `instagramDrafts.enabled` switch permits new claims. Both start disabled. Keep the current publisher activation and pause settings unchanged while deploying this addition. Disabling generation prevents new claims; an already claimed render may finish as an unapproved draft.

Configure `SOCIAL_VIDEO_OIDC_AUDIENCE=https://api.jobverify.in/api/social-video-drafts` on the API, retaining the existing immutable GitHub repository/owner IDs. Only `.github/workflows/social-video-drafts.yml@refs/heads/main` with trusted branch subject and `schedule`, `workflow_dispatch`, or `workflow_run` identity can access the renderer API. Renderer and publisher identities cannot use one another's endpoints. The runner receives no database, R2 or provider credentials.

The template uses factual copy, Indian English narration (`en-IN-NeerjaNeural`), burned captions and original quiet music. Outputs are a 1080x1920, 30 fps, progressive H.264/yuv420p closed-GOP fast-start MP4 (15-30 seconds, AAC 48 kHz/128 kbps target, <=16 MiB), portrait JPEG cover (<=2 MiB) and private SRT (<=64 KiB). API-side structural validation and content hashes bind all three files to the current facts, plan, revision and lease. Video responses stream from R2 with HEAD and byte-range support. Unapproved assets require admin authentication.

In Admin > Social publishing, save generation filters, then open a ready draft and review the stored video, source facts, script, cover and Instagram caption. Approve Instagram for an existing future 10:00/18:00 IST slot. A Reel needs no LinkedIn image when approving Instagram alone; LinkedIn still needs its existing JPEG. Caption/source changes invalidate unsent approval. Generation never approves, schedules or publishes. The publisher prepares `media_type=REELS` with the approved video/cover URLs, checks processing, publishes and verifies a Reel receipt through the existing durable pipeline.

Generation leases last ten minutes, renewed every 45 seconds by the runner. Stale workers cannot attach results after replacement, cancellation or refresh. Transient failures retry with backoff across runs up to three attempts; permanent failures remain visible with admin Retry. Retry preserves the campaign and rechecks source eligibility. A narration failure remains a failed draft rather than switching audio format. Published/uncertain delivery recovery continues to use the existing reconciliation controls; never blindly resend.

Deploy API and index changes before the admin UI and publisher updates. Before enabling production generation, run one fixture through the deployed isolated workflow/API/R2 path, then inspect one real unapproved draft in Admin. A live pilot uses the existing individual approval controls. These deployment checks are separate from local verification. Rollback disables `SOCIAL_VIDEO_DRAFTS_ENABLED` and the admin generation switch; retain approved assets/history and the publisher pause control.

Renderer setup and asset provenance: `scripts/social-video/README.md`. Local checks: `node --test --test-concurrency=1 test/social*.test.js`; `python -m unittest discover -s scripts/social-video` (set `SOCIAL_VIDEO_RENDER_INTEGRATION=1` for a real fixture render); Worker checks including `workers/api/test/socialVideoRuntime.test.js`; frontend browser social-publishing tests. Serial social tests avoid competing Mongo fixture startups on smaller machines. All automated provider tests use mocks and do not post live.

Template `jobverify-reel-v6` uses colourful scenes, an employer-logo badge, a fixed employer strip above the divider and a separate labelled card for each available metadata field. The current layout halves the previous text sizes and labels the header "Jobverify.in" beside its logo. The renderer reads only the job's explicit `companyDomain` from the hashed API render plan, downloads bounded raster icons from the official HTTPS domain and falls back to company initials if unavailable. The manifest records logo provenance; existing approved media and factual snapshots remain valid. Deploy the API and authorized renderer together. A changed company domain rejects an in-progress completion and requires a draft refresh.

The final card adds a scannable QR for the exact JobVerify job page, bound to `plan.jobUrl` and checked against the selected job ID. The QR holds for at least three seconds before the outro. Captions use Anton with timed lime highlights. Narration ends with "Follow JobVerify.in"; the header logo moves to the frame centre on the spoken word "Follow". Deploy the API and authorized runner together for the v4 contract. Reels also retain the job link in their caption. Each new Instagram caption includes its own direct JobVerify job URL (`utm_source=instagram`); no per-job profile-link update is needed. Caption text does not guarantee a clickable link: availability depends on Instagram account features. See [Meta link features](https://www.meta.com/meta-one-plans/). Refresh an unapproved old draft to prepare a new package.

The v6 narration speaks only the first location name and ends with "Follow JobVerify.in for more jobs." It introduces the QR with "Scan the QR code for full details and to apply." The QR target and centred closing mark are 728 pixels, 40% larger than their previous 520-pixel targets. Deploy this API plan contract and runner together; existing rendered assets are unchanged.

Template v6 fixes new Reels at exactly 15 seconds. Pitch-preserving narration fitting scales word timings with audio, and the QR begins early enough to remain visible for at least three seconds before the follow cue. Supporting text and captions are doubled; a small transparent cartoon woman occupies a reserved area at the lower left. The current company/role type sizes and fixed company strip remain in use. Deploy the API contract and authorized runner together; existing rendered assets remain valid.
