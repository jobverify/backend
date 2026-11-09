# Full catalog description trial

This experimental path runs the configured catalog in dry-run mode and writes only local files. It shares the pinned LFM2.5-1.2B-Instruct QAD Q4_0 GGUF and CPU llama.cpp runtime with production. Its experimental draft policy below remains separate from production policy v15, which uses compact fact-plan decisions. The trial does not publish results or change production classifications. No local tests or inference were run for the v14 fixes; validation is deferred to the GitHub pipeline. Do not run these optional local commands unless requested.

Start a fresh trial from the backend:

~~~powershell
$runStamp = Get-Date -Format 'yyyyMMddTHHmmss'
$runDir = Join-Path $PWD ('.cache/description-rewriter/trials/catalog-trial-' + $runStamp)
node scripts/trialCatalogDescriptions.js --run-dir $runDir --model-threads 4
~~~

Scraping uses `SCRAPER_CONCURRENCY` from the process environment, then the backend `.env`, with a one-source fallback when unset. Workday uses one detail request. Future trials set Workday's optional detail budget to eight minutes within the ten-minute source lifecycle cap. The normal thirty-second detail default left large captured boards with listing-only jobs and no description for the LLM. Provider-specific detail budgets can still take precedence, and upstream failures can still retain listing-only entries. This change does not recover descriptions in an already stopped trial. Rewriting uses one generation request at a time, taking turns between ready company captures. It begins as atomic raw captures arrive and drains all pending jobs after the scraper finishes. Immutable raw captures and normalized snapshots prevent later scrapes from changing trial inputs.

The model writes a short role overview with two individually cited sentences. All detailed employer facts remain under structured headings. This is partly rewritten content: the detailed requirements are preserved verbatim. Mixed required/preferred wording, insufficient input and failed draft checks keep the complete original description. Every output is unpublished, with before/after text, source hashes, evidence, timing and validation results. Passing checks is not a manual publishability judgment.

Trial policy v5 excludes opportunities offered to the applicant from duty evidence. It preserves identical text in different requirement sections and binds separate travel, relocation, position-type and referral-plan values to their source labels. It also recognizes additional employer role, qualification and office-policy headings. These context rules belong to the experimental trial parser. Production now uses the separate section protocol described in [README.md](README.md). Existing v4/v5 case files and reviews are historical; changed model fingerprints require a fresh trial directory. A replay is not a new model generation.

These checks address observed failures, not general semantic correctness. Lexical overlap cannot establish that a paraphrase preserves who does what, conditional scope or recruitment availability. Every trial draft still requires individual source comparison and remains unpublished.

The independent monitor samples host CPU and physical memory every two seconds. Either reading above 90%, or a monitoring failure, aborts inference and signals the owned scraper supervisor directly, also requesting a durable stop. The scraper has a ten-second forced-shutdown grace period. No automatic resume occurs after a resource stop. Unrelated processes are untouched. resources.ndjson and resources-status.json retain measurements; rewrites/summary.json retains queue progress.

Write trial-stop-request.json in the run directory to stop gracefully. A non-resource interruption can resume with --resume and the same rewrite directory. If the prompt, parser or pinned model changes, choose a new --rewrite-directory such as rewrites-v2; the launcher rejects stale draft-policy reuse. It requires the same dry checkpoint/catalog and a dead previous owner.

Generation continues locally beyond the scraper's completion. A catalog of tens of thousands of jobs can require days on CPU; use measured throughput rather than assuming a six-hour completion. The GitHub Actions production path uses its existing bounded generation budget and durable pending queue across runs. This local experiment adds no MongoDB backfill.


## Repeat a completed full trial

A durable repeat controller waits for the first full dry scrape, all rewrite cursors, and owned worker cleanup. It writes a full automated analysis plus source/draft review bundle, then starts exactly one independent second full dry trial with fresh raw captures and case files. After the second finishes, it saves another analysis and an unchanged-source comparison. Automated analysis is explicitly separate from manual publishability review. No outputs are published.

From the backend:

~~~powershell
node scripts/repeatCatalogDescriptionTrial.js --first-run '<existing trial directory>' --first-output rewrites-v4
~~~

The controller uses an exclusive repeat.lock and repeat-state.json. A durable launch claim suppresses duplicate starts after an uncertain launch. The second trial requires the same configured catalog, pinned policy and trial runtime as when it was queued. Each run uses four model threads, sequential generation and the existing 90% resource stop. The controller also monitors CPU/RAM while reporting; a resource breach stops the sequence without automatic restart. Write repeat-stop-request.json in the first directory to stop the coordinator and its current owned trial gracefully.

Reports are saved as analysis/report.md, analysis/report.json and analysis/review-samples.md in each run. repeat-comparison.json lives in the first directory. Full manual review remains pending until a person/agent actually reviews the finished outputs; these artifacts do not claim it occurred.
