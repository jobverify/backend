# Resume preparation and tailoring

Changed PDF, Word and TeX uploads automatically queue preparation; identical bytes reuse preparation. Original bytes remain unchanged in Resume (500 KB maximum). Legacy uploads expose Prepare resume without bulk conversion. Saving a job never triggers inference. Explicit tailoring requires a prepared base and saved job.

One tailored-resumes.yml run processes one preparation or tailoring item, serially, with a 30-minute job limit. Preparation generates full base LaTeX and PDF. Tailoring uses the entire base LaTeX, source facts and a versioned candidate-facing job snapshot. Oversized input is rejected without truncation. Scanned PDFs require an extractable-text version; OCR is not used.

## Model and compiler

resume-tailoring/resume-model.json pins Qwen3-4B-Instruct-2507 Q4_K_M, repository revision, checksums and llama.cpp runtime. Every complete rendered prompt is token-counted, including source comparison and repair. LaTeX inference uses a grammar with a fixed cached preamble and supported commands; candidate content remains model-generated. The factual comparison uses a separate JSON schema.

resume-tailoring/compiler pins Tectonic 0.17.0 and warms trusted packages against a fingerprinted v33 bundle before processing candidate data. Docker compilation receives TeX via stdin and returns only PDF bytes. There are no host mounts, network, credentials, elevated capabilities, writable root filesystem or shell escape. Runtime, memory, processes and temporary file sizes are bounded. There is no unsandboxed fallback.

Publication requires readable PDF text, minimum 10pt text, page-boundary checks, protected identity/contact/link/employment/education/date/number validation, and a separate LLM source comparison. Base documents preserve complete facts without a page target. Tailored documents must fit two pages. One repair is allowed. Generation and its repair share the worker deadline with up to three minutes reserved for compilation and validation; there is no additional eight-minute model cutoff. Failure preserves the previous successful version and exposes retry.

## Storage and authenticated document APIs

ResumeArtifact stores immutable owner-scoped generations: LaTeX up to 256 KB, PDF up to 5 MB, grounding facts, source hashes and model/style versions. JSON APIs expose metadata only. Document endpoints require authentication and use Cache-Control: no-store.

- POST /api/user/resume/prepare queues or retries preparation.
- GET /api/user/resume/base?format=pdf|tex previews the base.
- GET /api/user/resume/base/download?format=pdf|tex downloads the base.
- POST /api/user/tailored-resumes/:jobId explicitly requests tailoring.
- GET /api/user/tailored-resumes/:jobId/pdf previews the PDF.
- GET /api/user/tailored-resumes/:jobId/download?format=pdf|tex downloads; PDF is the default. Legacy JSON drafts require regeneration.

Revisions, persisted leases, source hashes and job hashes prevent late writes after retry, replacement, unbookmarking or deletion. Stale downloads are rejected. The latest successful base and result per user/job are retained, with the prior success preserved during regeneration.

## Deployment and rollout gates

1. Keep TAILORED_RESUME_ACTIONS_ENABLED=false until validation is complete.
2. Deploy workflows and worker code to the backend default branch. Configure backend GITHUB_REPO and GITHUB_PAT (repository Actions read/write), and repository Actions secret MONGO_URI. The database secret belongs only to the generation step. Review npm run db:indexes:plan and apply the new preparation-queue and ResumeArtifact owner indexes with the existing index tool before enabling generation.
3. Deploy API and frontend. In isolated QA accounts repeat upload/retry/replacement/removal and preparation/tailoring for representative jobs using the authorized resume. Visually inspect every PDF page and verify PDF.js previews and PDF/TeX downloads. Delete QA records afterward.
4. Enable dispatch after these gates pass. Preparation and tailoring share persisted deduplication and recovery. There is no application-imposed monthly Actions run cap; the retired TAILORED_RESUME_ACTIONS_MONTHLY_RUN_LIMIT setting is ignored. Each job can use up to 30 minutes, with a 28-minute worker deadline that includes setup and leaves time for cleanup. Existing per-user tailoring allowance remains ten requests per UTC day.

Only immutable model/runtime archives and the trusted compiler image are cached. Resumes, prompts, TeX, PDFs and compiler logs are never cached or uploaded as Actions artifacts. Worker output contains aggregate counts only.

## Validation

    node --test test/resume*.test.js test/tailoredResumeActionsWorker.test.js
    npm run lint

Unit, Mongo and browser fixtures verify application behavior. Validate model quality, PDF rendering and runner speed through the preparation and tailoring QA flow before enabling generation.
