# ClassKlap native evidence

The original adapter returned an unconditional empty array without making a request. It now fetches and validates the exact ClassKlap native employer and its checked employer-filtered India and Worldwide searches. All requests and streamed bodies share one aggregate deadline, bodies have a byte limit, rejected unread bodies are cancelled, and caller abort reasons are preserved exactly. Transport or markup failures produce typed CLASSKLAP_COVERAGE_GAP errors. Unrelated --dry-run arguments have no import-time persistence effects.

Actual root-owned Chrome captures on 2026-10-23 establish:

- Corporate root https://www.classklap.com/ and /careers each returned HTTP 404 with Squarespace Website Expired content.
- Native employer https://www.linkedin.com/company/classklap/ names ClassKlap, identifies organization 18717228, and reciprocates http://www.classklap.com. This is employer identity evidence; an outgoing official recruiting handoff remains unproven, so firstParty is false.
- Exact checked employer filters https://www.linkedin.com/jobs/search/?f_C=18717228&location=India and the corresponding Worldwide request returned HTTP 200 with explicit no-match states and zero observed cards. These bounded observations do not establish whole-company emptiness.
- Parent https://www.eupheus.in/ failed transport. Its separate navigation showed a certificate error. No HTTP status, final response URL or body is inferred for that failure, and its Career route could not be inspected. Separate LinkedIn navigation reached an authwall, although direct captured native requests returned the retained employer/search bodies.

No current native exact-employer vacancy was recovered. Company and India totals remain null. Inventory status is coverage-gap; listing completeness, scope completeness and lifecycle cleanup are false. New native role links, cards, structured JobPosting, publication, expiry or country metadata fail for review instead of retaining a cosmetic empty outcome. Headquarters country never supplies a vacancy country; capture time never supplies publication time. No eligibility gate changed. Missing-description eligibility remains allowed by the wider pipeline when other gates pass.

The compressed fixtures retain the original request receipts and separate navigation observations. capture-manifest.json records gzip, uncompressed and response-body SHA-256 hashes. catalog-candidate.json has repository-relative module, dry-run and manifest paths for root integration.

Verification: node --test scraper/classklap/script.test.js. Seven original transport tests failed with Missing expected rejection before the change. The repaired suite covers actual receipt replay, bounded no-match scope, unknown totals, employer/filter/role/country/date/expiry drift, deadlines, streamed byte limits, unread-body cancellation, exact abort reasons, import side effects and receipt hashes. Offline replays validate the captured responses; future network availability and whole-company completeness remain unproven.
