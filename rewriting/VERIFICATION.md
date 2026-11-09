# Description rewriting verification status

The historical checks below were recorded locally on 11 October 2026 with an earlier checkpoint. They do not verify current policy v14. The Qwen v13 GitHub run published two descriptions in five hours, with 34 failed rewrites and three preflight skips, then left the pipeline incomplete at its normal budget; see [BENCHMARK.md](BENCHMARK.md). No local tests, syntax/lint checks, model download or inference were run for the v14 fixes, as requested. Pipeline validation remains pending. No workflow was dispatched, repository variable changed, or production MongoDB data written for these fixes.

## Result

The checkpoint and CPU/memory settings remain unchanged. Policy v14 uses at most two 160-character edits from six job-focused candidates, deterministic source-fact rendering, short eight-job page queries, 1,024 initial output tokens, at most one retry up to 2,048 tokens within the shared 600-second deadline, and bounded rejection diagnostics. New regression cases cover schema bounds, company-prompt filtering, per-source action/detail preservation, source-only rendering without inference, raw partial JSON and stream failures, varied rejection samples, cancellation/error priority, and normal-budget classification handoff. They remain unexecuted. Existing v13 paging, scope, cache and retry regression cases also remain unexecuted locally.

The generic publishing filter rejects absent, null, blank, spacing-only and empty-HTML employer descriptions before enrichment, persistence and rewrite queueing. Explicitly empty source content cannot fall back to generated display text. Historical records with empty sources are excluded from public queries and counts. Filter diagnostics and resume checkpoints include filteredEmptyDescription. An empty later scrape cannot replace the last valid stored description; raw snapshots remain available for diagnostics.

## Historical checks for the previous checkpoint

| Check | Result |
| --- | --- |
| Description/admin/queue/persistence/visibility regression suite | 132/132 passed |
| Native MongoDB empty-description visibility | Passed, including 10,000 empty tags, long script bodies, and a long whitespace/markup prefix preceding real text |
| Frontend unit suite | 444/444 passed |
| Admin description browser checks | 3/3 passed; LFM label, persisted auto-run switch, manual dispatch, errors and mobile state verified with mocked APIs |
| Native pinned LFM production worker/client | Passed; 1410 ms for one sample, 392.1 MiB worker memory, 63.4% peak host memory |
| Existing host memory cutoff tests | 3/3 passed; >90% stops its child, high memory prevents startup, high CPU alone does not stop it |
| Backend syntax check | Passed; 15,443 JavaScript files checked |
| Patch whitespace check | Passed |
| Broad backend npm test | 18,470 passed, 214 failed, 12 skipped |

The native worker smoke test uses predownloaded, checksum-verified assets and an in-memory update callback. It checks literal employer wording and required/preferred sections, stops above 90% host RAM, and always shuts down the worker. One sample is not a 30,000-job benchmark or a GitHub throughput guarantee. The earlier full LFM dry run is documented in [BENCHMARK.md](BENCHMARK.md).

The broad suite is not green. Scraper/catalog tests fail, and classification files were concurrently edited or removed during the run. These results therefore do not describe an immutable release snapshot, and not every failure is attributed to a pre-existing issue. After those edits, the latest focused description regression run passed all 132 tests. Raw local logs are in .cache/lfm-description-regressions.log, .cache/lfm-full-tests.log, .cache/lfm-native-smoke.log and .cache/lfm-lint.log.

See [CONTROLS.md](CONTROLS.md) for admin configuration and the live GitHub acceptance checks.

## Broad-suite failure names

The names below are copied from the complete test log, including reported parent failures. Repeated copies in the reporter's final recap and entries for the removed classification implementation are omitted. The totals above describe the original broad-suite snapshot. GLiClass cleanup was checked separately with 134 passing classification/persistence regressions.

- Harbinger Systems run validates the current careers shell before using Darwinbox listings
- IndiaMART local catalog captures the verified first-party careers microsite and Klimb board contract
- IndiaMART exact-name backlog rows resolve from local provider metadata without aliases
- getScraperCatalog includes IndiaMART as a verified Klimb provider
- buildScrapers exposes a runnable IndiaMART scraper without changing the runner contract
- IndiaMART falls back to a browser-backed page loader when Node fetch times out
- IndiaMART falls back to a browser-backed pagination loader when the Klimb JSON request times out
- Kumaran Systems local catalog captures the verified first-party careers page and public jobs API
- Napier Healthcare Solutions exports the verified fail-closed careers contract
- Rave Technologies catalog tracks the NEC rename evidence, forbidden successor shells, and SmartRecruiters board
- Aditya Birla Capital local catalog captures the verified first-party jobs surface
- buildScrapers and company coverage resolve Aditya Birla Capital from the shared catalog
- Aditya Birla Capital scraper constants stay pinned to the verified official careers surfaces
- extractSearchResults maps the first-party Aditya Birla Capital jobs payload into the shared job shape
- Aditya Birla Capital detail-page helpers decode both verified public apply handoffs
- run validates the official Aditya Birla Capital careers surfaces and decorates jobs for the shared runner
- Aditya Birla Capital fails closed when the verified public apply handoff drifts
- getScraperCatalog includes ADOR as a public careers-page scraper
- buildScrapers exposes a runnable ADOR scraper without changing the runner contract
- extractSearchResults maps ADOR careers cards into conservative job records
- run fetches the ADOR careers page and decorates the extracted openings
- buildScrapers and company coverage resolve ArcelorMittal Nippon Steel India from the shared catalog
- getScraperCatalog includes the Ashok Leyland Darwinbox-backed script provider with official metadata
- buildScrapers exposes a runnable Ashok Leyland scraper without changing the runner contract
- createAshokLeylandScraper targets the Ashok Leyland Darwinbox host and company id
- run keeps Ashok Leyland jobs on the hosted Darwinbox routes and decorates the shared runner fields
- Bajaj Allianz local catalog captures the verified legacy-brand redirect and first-party nonlisting jobs shell
- Bajaj Allianz backlog matching works directly from the local catalog without an alias entry
- buildScrapers and company coverage resolve Bajaj Allianz from the shared catalog
- Bajaj Allianz constants stay pinned to the verified legacy redirect, current homepage handoff, jobs shell, and broken direct careers route
- Bajaj Allianz sentinel returns [] only while the verified redirect, jobs shell, and broken direct careers route remain unchanged
- Bajaj Allianz sentinel fails closed when the redirect, homepage handoff, jobs shell, or broken direct careers route drifts materially
- Bajaj Auto catalog captures the verified first-party careers hub, jobs page, APIs, and detail shell urls
- buildScrapers and company coverage resolve Bajaj Auto from the shared catalog
- Bajaj Auto pins the verified first-party careers hub, search page, career bundle, api contracts, and detail shell
- Bajaj Auto run verifies the first-party surfaces and returns normalized jobs from the requisitions api
- Bajaj Auto fails closed when the verified careers page, bundle, api contracts, or detail shell drift
- getScraperCatalog includes Bajaj Electricals on the verified official page backed by Darwinbox
- buildScrapers and company coverage resolve Bajaj Electricals without aliases
- Bajaj Electricals scraper keeps the verified official Darwinbox pointer explicit and fails closed on drift
- run maps Bajaj Electricals Darwinbox listings into Jobverify jobs and keeps only India roles
- Bajaj Finserv local catalog captures the verified first-party PeopleStrong handoff surface
- Bajaj Finserv exact backlog name matches from the local provider contract without aliases
- buildScrapers and company coverage resolve Bajaj Finserv from the shared catalog
- getScraperCatalog includes Bajaj Finserv Health as a PeopleStrong script provider
- buildScrapers exposes a runnable Bajaj Finserv Health scraper without changing the runner contract
- buildApiUrl keeps Bajaj Finserv Health on the public PeopleStrong jobs feed
- extractSearchResults returns no jobs when the live Bajaj Finserv Health PeopleStrong feed is empty
- run posts the empty search body to Bajaj Finserv Health PeopleStrong and decorates shared runner fields
- Bajaj Finserv scraper keeps the verified PeopleStrong handoff explicit and pinned to the live public API contract
- extractSearchResults maps public Bajaj Finserv PeopleStrong listing fields
- run verifies the known Bajaj Finserv handoff before replaying the public PeopleStrong API
- Bajaj Finserv scraper fails closed when the verified handoff or public portal shell drifts
- getScraperCatalog includes Bajaj Housing Finance as a verified no-public-careers surface
- buildScrapers and company coverage resolve Bajaj Housing Finance without aliases
- Bajaj Housing Finance verifies the homepage and sitemap while keeping common careers routes absent
- Bajaj Housing Finance returns an honest zero-job result while no public careers surface is exposed
- Bajaj Housing Finance fails closed if the sitemap starts exposing a careers route
- getScraperCatalog includes Bajaj Markets on the verified official page backed by Darwinbox
- buildScrapers and company coverage resolve Bajaj Markets without aliases
- Bajaj Markets scraper keeps the verified official Darwinbox handoff explicit and fails closed on drift
- run maps Bajaj Markets Darwinbox listings into Jobverify jobs and keeps only India roles
- run preserves the verified Bajaj Markets Darwinbox board while the official careers page shows branded maintenance copy
- run can recover the official Bajaj Markets careers handoff with a browser-backed HTML fetch
- Bajaj validator signals accept the current public title and canonical variants from Saturday, July 25, 2026
- Canva helpers stay pinned to the verified first-party jobs board contract
- Canva run paginates the official first-party jobs board and keeps only India roles
- Canva fails closed when the verified jobs surface or first-party job URLs change
- getScraperCatalog includes Cars24 as a verified first-party jobs-api scraper
- buildScrapers and company coverage resolve Cars24 from the shared catalog
- Cars24 verifies the official first-party careers surfaces and extracts India jobs from the public jobs feed
- Cars24 run scrapes the verified first-party jobs API and enriches jobs from the official detail route
- Cars24 keeps listing-level jobs when transient detail API rate limits block enrichment
- Cars24 fails closed when the verified careers shell or public API contracts change
- Delhivery catalog captures the verified August 14 careers app shell and Darwinbox listing surface
- Delhivery backlog row matches directly from local provider metadata without alias churn
- buildScrapers and company coverage resolve Delhivery from the shared catalog
- Delhivery scraper keeps the verified August 14 careers app shell and Darwinbox routes explicit
- Delhivery official surface capture parses the current careers app shell over native HTTP
- Delhivery run accepts the verified careers app shell, verifies the Darwinbox home shell, and returns normalized India jobs
- Delhivery returns a current-openings signal job when the public Darwinbox inventory API is blocked but both verified shells remain reachable
- Delhivery scraper fails closed when the careers shell or Darwinbox home shell drifts
- Dr. Reddy's Laboratories local catalog captures the verified first-party Attrax careers surface
- Dr. Reddy's Laboratories exact backlog name matches from the local provider contract without aliases
- Dr. Reddy's Laboratories scraper stays pinned to the verified first-party careers handoff and Attrax jobs pages
- extractSearchResults keeps India Attrax vacancies and normalizes Dr. Reddy's listing fields
- extractJobDetail enriches Dr. Reddy's detail pages with workflow apply links and qualification fields
- run verifies the Dr. Reddy's handoff pages, crawls paginated India listings, and enriches detail pages
- Dr. Reddy's scraper fails closed when the verified handoff or Attrax detail page drifts
- Email applications sharing a careers page retain distinct stable persistence identities
- Fortis Healthcare local catalog captures the verified first-party careers handoff to Oracle Cloud
- Fortis Healthcare exact backlog row resolves directly from local provider metadata without aliases
- scraper-support\tests\fortisHealthcareScript.test.js
- Godrej Consumer Products catalog metadata captures the verified first-party careers page and official apply host
- Godrej Consumer Products matches exact-name backlog coverage from the local catalog contract alone
- Godrej Consumer Products accepts the embedded careers state and keeps only GCPL roles
- Godrej Consumer Products run decorates extracted embedded GCPL jobs for persistence
- Godrej Consumer Products falls back to browser-rendered careers HTML when the direct response lacks parseable job data
- Godrej Properties local catalog captures the verified first-party handoff and shared-parent sentinel surface without alias churn
- Godrej Properties exact backlog row matches directly from the local provider metadata
- Godrej Properties hydrated local catalog stays script-runner compatible for later registry integration
- Godrej Properties sentinel helpers stay pinned to the verified first-party handoff and shared-parent shell
- Godrej Properties returns [] only while the verified first-party handoff and shared-parent shell remain unchanged
- Godrej Properties fails closed when the first-party handoff or shared-parent shell drifts into a public jobs surface
- getScraperCatalog includes Godrej Enterprises Group as an official careers public-openings scraper
- buildScrapers exposes a runnable Godrej Enterprises Group scraper without changing the runner contract
- Godrej & Boyce maps to the verified Godrej Enterprises Group careers surface through aliases
- Godrej Enterprises Group extracts public openings from the verified first-party careers page
- Godrej Enterprises Group run decorates official openings for persistence
- Godrej Enterprises Group scraper fails closed when the verified public row structure or vacancy host changes
- Johnson Controls India local catalog captures the verified first-party search page and Algolia contract without aliases
- Johnson Controls India backlog row matches directly from the local catalog without alias churn
- Johnson Controls India scraper pins the verified official search page and Algolia query contract
- Johnson Controls India extracts verified India jobs from the Algolia search payload
- Johnson Controls India run validates the official search page and paginates the verified Algolia index
- Johnson Controls India fails closed when the verified search page or Algolia payload drifts materially
- Karur Vysya Bank local catalog captures the verified first-party Zwayam careers surface
- Karur Vysya Bank exact-name backlog row resolves directly from the local provider contract without aliases
- Karur Vysya Bank helpers stay pinned to the verified Zwayam careers contract
- Karur Vysya Bank search extraction keeps only open jobs and normalizes locations
- Karur Vysya Bank scraper validates the verified surfaces before returning jobs
- Karur Vysya Bank fails closed when the verified homepage, careers shell, or company config changes
- getScraperCatalog includes the Legrand Oracle Cloud script provider with official metadata
- buildScrapers exposes a runnable Legrand scraper without changing the runner contract
- Legrand scraper normalizes India Oracle CE requisitions and enriches them end to end
- 3Pillar accepts a verified empty Lever array
- 3Pillar rejects malformed nonempty Lever payloads
- 3Pillar caller limits cannot mark a truncated listing complete
- 3Pillar rejects an empty or short API inventory that contradicts its current board roles
- Manatec run bounds an injected hung page and stops on first outage
- Manatec HTTP403 preserves saved jobs and does not query further routes
- Micron Technology India run verifies the official careers page and maps public India Eightfold jobs into Jobverify jobs
- Nektar AI catalog captures the verified first-party careers redirect and Coda handoff
- Ninestars scraper fetches the verified homepage, careers handoff shell, and client bundle then normalizes jobs
- saveToDB preserves last good source content when a detail fetch fallback is persisted
- registers Protiviti against the official careers page and verified public Workday source
- uses the Protiviti Workday jobs API so the verified India filter returns an honest zero-result source today
- QuadEye local catalog captures the verified first-party careers page and public Zoho API metadata
- QuadEye helper exports stay pinned to the verified official careers page, Zoho portal, and public API contract
- QuadEye and VGS effective catalogs describe the verified complete public inventories
- dry-run runner reports publishable job counts and rejection totals for summary logs
- getScraperCatalog merges workday and official portal providers into one registry
- buildScrapers keeps the existing runner contract while exposing provider metadata
- normalizeScrapedJob enriches engineering jobs into the unified scraper schema
- script catalog entries that destructure fetchText provide a production default fetcher
- persistence writes both generic-form roles and preserves the incomplete snapshot
- Sigma Solve local catalog captures the verified first-party openings page and same-domain detail contract
- Sigma Solve helpers stay pinned to the verified first-party openings route and detail-link pattern
- Sigma Solve extracts the verified first-party detail page into shared scraper job fields
- Sigma Solve run validates the official openings page and returns normalized same-domain jobs
- scraper-support\tests\tataMotorsScript.test.js
- getScraperCatalog includes TVS Motor Company as a Darwinbox-backed script provider with official metadata
- buildScrapers exposes a runnable TVS Motor Company scraper without changing the runner contract
- createTVSMotorCompanyScraper targets the TVS Motor Company Darwinbox host and company id
- run keeps TVS Motor Company jobs on the hosted Darwinbox routes and decorates the shared runner fields
- thinkbridge local catalog captures the verified first-party job-search page
- Algonomy local catalog captures the verified first-party page and embedded Paycor handoff
- thinkbridge run returns normalized global jobs from the first-party job-search cards
- thinkbridge accepts the Monday, August 17, 2026 first-party job-search cards after the sample role refresh
- Atidiv local catalog captures the verified server-rendered current openings surface
- A3logics local catalog captures the verified first-party careers page and Keka handoff
- Nuvento Systems local catalog captures the verified first-party India careers page
- Nuvento Systems run returns normalized jobs from the verified India careers page
- workbook batch 02 registers the expected providers and the scoped Cibil alias only
- Locus catalog entry points to the verified careers handoff and Freshteam board
- Sphera India verifies the first-party handoff and emits only India Workday roles
- workbook batch 10d providers stay exact-name and fail closed
- workbook batch 10e providers resolve through the shared catalog
- Anand Engineering Products Pvt Ltd. is registered as a verified missing-first-party-surface sentinel without aliases
- Anand Engineering Products Pvt Ltd. is runnable through the scraper provider catalog
- scraper\anandengineeringproductspvtltd\script.test.js
- Courtclik scraper returns no jobs while the verified homepage and careers page remain stable
- Courtclik default page fetches are bounded with abort signals
- Courtclik scraper fails closed when the homepage or careers zero-openings surface drifts
- Cuelogic recognizes the current LTIMindtree certificate mismatch even when only the message survives retry wrapping
- Cuelogic returns [] while the verified LTIMindtree jobs surface still terminates in the known TLS-broken redirect host
- verified ESDS listing cards remain usable when detail routes now hand off to the Darwinbox shell
- fresh employer-published client identity recovers public India jobs when only company configuration access fails
- LifeSigns is registered with the verified first-party careers page and no alias requirement
- Manatec Electronics Private Limited is registered with the verified first-party careers page and needs no alias
- Manatec Electronics run() validates the verified application-only public surface and returns no structured jobs
- Manatec Electronics returns no jobs when the verified public site is uniformly blocked by the current 403 shell
- Manatec Electronics fails closed when the careers surface drifts or starts exposing structured openings
- Manycon Trading and Contracting is registered as a first-party inventory-unavailable provider without aliases
- Prism RMC scraper fails closed when the verified public surface drifts
- Schwing Stetter is registered against the verified official Stetter careers board
- Simplify3x sentinel accepts the current blocked no-public-jobs route shape
- Simplify3x sentinel returns no jobs when common job routes are blocked and expose no public listings
- Winman returns jobs from the verified first-party careers table
- YelloSKYE is registered as a first-party inventory-unavailable provider without aliases
- rescrapes with valid descriptions update all authoritative fields together
- persisted authoritative categories and experience filters agree with Mongo and alerts
- generated dedicated scraper backfill manifest stays aligned with local source files
- Mongo category decisions match response normalization for legacy and experience variants
- experienced job visibility is reversible and consistent across public surfaces
- first 1000 selection follows the executable catalog order through its boundary
- trusted fresher eligibility outranks title-based manager assumptions and contradictory confident AI
- preferred-only years remain preferred and cannot exclude freshers
- all explicit source arrangements override a contradictory model label
- written-out experience years are retained and no-experience facts cannot become prior-required
- retired-company purge removes only the selected provider data
- Waymo coverage matches only the literal CSV company name
- Waymo scraper fails closed without a verified enumerable extraction contract
