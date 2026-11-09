Doubtnut native source repair (2026-10-23)

This source previously returned [] without reading any source. RED.txt records the original failing regression. The adapter now uses bounded streamed native requests, an aggregate fetch/body deadline, exact caller cancellation and factory/run dependency forwarding. Importing the source with an unrelated --dry-run argument has no persistence or transport side effect. No database writes or publication are performed.

Observed primary evidence:
- Doubtnut native employer profile is organization 13222185. It identifies the Doubtnut Android app; organization headquarters country is not used as job geography.
- Employer-filtered India and Worldwide searches each expose an exact checked employer filter and a no-match heading. These public guest observations are incomplete and do not establish company-wide emptiness.
- Employer-authored hiring post of 2020-03-20T16:52:39.513Z explicitly links the Doubtnut Freshteam /jobs tenant. Its engineering role categories have no explicit job country.
- Identical employer-authored full time sales posts have native dates 2023-09-27T13:43:17.573Z and 2023-10-25T16:55:31.387Z. They are grouped as one historical opportunity with earliest observed publication September 27; the October repost never refreshes age. Each links a Google-form short URL. It has no explicit job country or proven active application. Historical social publication remains historical; capture time never becomes posting time.
- Freshteam /jobs and root both return HTTP 200 with an invalid-domain/no-ats page. That is a retired/unavailable tenant diagnostic, never a verified-empty inventory.
- Corporate homepage capture failed with TypeError: Failed to fetch. It supplies no HTTP status, final URL or body. Its failed envelope is preserved verbatim in the fixtures. Current corporate recruiting association remains unproven, so firstParty is false.

No eligible current vacancy was established. Reviewed historical candidate observations are retained as exclusions with original publication, unknown country and activeApplyVerified false. Source-wide counts are null, listing/scope completeness false and lifecycle cleanup disabled. The known employer no-match and invalid-tenant states return coverage-gap evidence; network errors and changed native identity/structure throw DOUBTNUT_COVERAGE_GAP. New structured JobPosting, microdata, country/date/expiry metadata or changed vacancy prose requires review. Images, unauthenticated hidden content, private recruiting systems and unvisited short-form application links are not asserted as extracted vacancies.

The native observation set is deliberately bounded and incomplete; newly visible vacancy cards or a reactivated ATS fail review instead of being silently ignored. No job date, India country or active application is inferred. The missing-description eligibility policy is unchanged.

Validation: node --test scraper/doubtnut/script.test.js test/doubtnutCoverage.test.js
The source tests replay actual captured response envelopes (not reconstructed HTTP facts), verify gzip and raw-body SHA256 receipts, and check identity/scope/metadata drift, transport failure, streamed limits, deadlines, caller abort and import safety. Mutated fixture tests are explicitly artificial drift tests, not live evidence.

Catalog candidate: scraper/doubtnut/catalog-candidate.json. Candidate paths follow existing provider conventions (modulePath ../doubtnut/script.js; dryRunFile doubtnut/jobs.json). Shared registry/audit changes are outside this source's ownership.
