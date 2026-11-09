# FITTR native source evidence

Repaired the original unconditional-empty adapter. The adapter now fetches and validates seven bounded native responses, preserves exact caller cancellation, and records typed `FITTR_COVERAGE_GAP` failures for transport, body, deadline or markup drift. Importing with an unrelated `--dry-run` argument has no persistence side effect.

Actual root-owned Chrome captures on 2026-10-23 establish these observations:

- Official home and coach-onboarding pages actively link the exact FITTR LinkedIn employer profile. Employer organization `2970058` names FITTR and reciprocates `http://www.fittr.com`. These social links do not establish an official recruiting handoff; emitted evidence retains `firstParty: false`.
- Exact checked employer filters for India and Worldwide each expose explicit no-match states and no job cards. This limited observation does not establish whole-company emptiness.
- Employer-authored Associate Manager - New Business and Strategy publication is `2026-01-07T12:43:43.444Z`, with location `Pune (Work from Office)` and application email `career@fittr.com`.
- Employer-authored Product Designer publication is `2026-04-27T07:35:08.162Z`, with no native job country or location and application shortener `https://lnkd.in/dAV6VQMX`. Separate navigation remained at that shortener with title LinkedIn; no final application target or active application was established.
- The company jobs-route request failed transport/CORS; it has no asserted HTTP status. Coach onboarding is not an enumerable employee-vacancy feed.

Both recovered social candidates remain in native collection evidence and are excluded for missing explicit job country. A city or headquarters address never supplies a vacancy country. The native public dates remain unchanged; capture time never becomes publication time. Active application is unproven. Whole-company and India counts remain null, inventory evidence is `coverage-gap`, and listing completeness, scope completeness and lifecycle cleanup are false. No eligibility gate was relaxed. Missing descriptions remain allowed by the wider pipeline, but neither candidate passes the other gates.

The adapter verifies native visible prose against its structured social text and reviewed prose hashes. Newly observed JobPosting, country, publication or expiry markup requires review and fails closed instead of silently keeping an empty result. Captures, including separate DOM/navigation observations, are gzip-compressed; `fixtures/capture-manifest.json` records compressed, uncompressed and response-body SHA-256 values. `catalog-candidate.json` uses repository-relative artifact paths and is a candidate for root integration.

Verification: `node --test scraper/fittr/script.test.js`. Original transport regression run had eight failures (`Missing expected rejection`); repaired tests cover actual response replay, identity/scope/content/date/country/expiry drift, unknown totals, deadlines, streamed byte limits, unread-body cancellation, exact abort reasons and import side effects. These are offline replays of actual receipts, not a claim that live network access is always available.
