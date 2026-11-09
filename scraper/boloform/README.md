Boloform's configured domain is currently unavailable as an employer surface.

On 2026-10-23, root-owned direct browser fetches of `https://www.boloform.se/`
and `https://boloform.se/` each returned HTTP 404, with unchanged final URLs and
2,516-byte Wix `ConnectYourDomain` error pages. These receipts establish an
upstream coverage gap. They do not establish a current employer identity,
recruiting handoff, absence of vacancies, or an India vacancy count. The configured
catalog name is Boloform AB; the similarly named BoloForms/BoloSign software
business is not substituted. Exact-name/domain web research found no primary
employer recruiting endpoint that could be verified for this configured employer.

The adapter performs a current bounded fetch of the configured www domain and
throws `BOLOFORM_COVERAGE_GAP` on unavailable or unreviewed source content.
Reported public/India counts stay null; scope and listing completeness and
lifecycle cleanup permission stay false. A newly accessible homepage requires
review of exact employer identity, native listings, explicit job country, earliest
public date, expiry and active application before it can produce jobs. Missing
descriptions do not relax any of those independent gates. No native vacancy was
recovered, so vacancy extraction remains unresolved upstream.

Transport supports injected factory/run options, exact caller abort reasons,
an aggregate fetch/body deadline, a 4 MB streamed body limit, and cancellation of
unread bodies on HTTP/final-URL failure. Importing alongside `--dry-run` has no
side effects. Direct CLI execution reports the gap with nonzero exit status and
does not save an empty inventory.

`fixtures/capture-manifest.json` gives exact relative gzip filenames, compressed
and uncompressed SHA256 digests, and actual response URLs/status/times/body
digests. Companion DOM receipts are retained separately. No synthetic response
is presented as a live capture. Controlled transport cases in tests are synthetic.

Validation: `node --test scraper/boloform/native.test.js test/boloformCoverage.test.js`.
Before implementation, the original unconditional empty adapter failed all nine
transport/coverage regressions with missing expected rejections. Current receipt
replay, bounded transport, exact cancellation and import side effects are covered.
`catalog-candidate.json` is the source-local metadata proposal; shared registry
integration is owned by the parent task.
