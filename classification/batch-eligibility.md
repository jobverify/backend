# Graduation batch eligibility

The existing `classify-jobs.yml` workflow runs batch eligibility as its final
phase in each shard. It covers all active jobs, including cached classifications;
it does not update inactive history or change job categories.

The graduating-year anchor advances on August 1 in Asia/Kolkata. For example,
August 2026 through July 2027 uses 2027. Employer-stated graduation years take
priority. Intern and Full-time Fresher default to the anchor. Other categories
use supported required experience: subtract completed whole years from the
anchor. A 3+ requirement produces an open upper bound, such as 2024 and earlier.

`eligibleBatches` stores exact years. `eligibleBatchRange.maxYear` stores the
inclusive upper bound for an open range. Their union is the matching set.
`eligibleBatchesProvenance` is `source`, `inferred`, or null. Public displays mark
inferred values as estimates. Operational evidence, hashes and progress are
stored separately in `batchEligibility` and omitted from public job responses.

The GLiClass worker stops before the local description instruction model starts.
Extraction is lazy and serial. It selects numbered original source clauses, and
the application validates quantities against those quotations. Preferences,
company history and missing numeric requirements do not establish experience.
Extraction results are cached by original source and extractor identity, so an
August refresh does not require another model call. Synthetic experience defaults
and inferred graduation years are never treated as employer facts.

Before accepting extraction results, the runtime must pass the checked-in reviewed
examples. To validate the actual local model without MongoDB:

```sh
node scripts/validateBatchEligibilityExtractor.js
```

Use `--download-assets` when verified runtime/model files are not cached, and
`--verbose` to inspect the reviewed examples' structured responses.

`POST_SCRAPE_CLASSIFICATION_MODE=shadow` stores proposed eligibility only;
`policy` publishes it. The existing workflow uses policy mode. Its first run after
deployment backfills active jobs. No separate migration or workflow dispatch is
needed. Deploy the API and frontend together so both understand ranges.

Source or classification changes reject stale writes. Unchanged scrapes preserve
eligibility; changed employer content queues recalculation. Unknown requirements
are a completed unknown result. Extraction failures remain retryable, and failed,
leased, interrupted or pending eligibility prevents a complete workflow result.
Shard summaries include explicit, inferred, unknown, failed and pending counts,
cache use and model requests under `batchEligibility`.
