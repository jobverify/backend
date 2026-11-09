# Reviewed candidate release, 2026-11-05

Keyence, Perfios, StanPlus and Data Patterns advertised the same new candidate
release. Their active official corporate links, exact tenant origins, current
shells and main-client bodies were read from public sources. The previous
per-source reviewed release remains supported; no API schema, employer,
country, pagination, detail, denial or closing validator was changed.

The current shell is byte-identical to the retained shell after substituting
only `main.819c4120b20f8091.js` and `runtime.aef58315a4bbce97.js` with their prior
filenames. Full shell SHA-256 and main-client SHA-256 are in
`reviewedCandidateReleases.json`. Each caller still fetches and hashes the
selected main client. Runtime filename/content declarations remain covered by
the complete shell digest; the observed runtime body hash is review evidence,
not a newly imposed runtime fetch requirement.

`test/test-data/darwinbox-client-method-review-20261105.json` retains full old and
current source bodies and an AST comparison for company configuration/group
reads, both listing methods, company/listing/detail transforms and detail reads.
Positions and minifier identifier spelling are omitted from the structural
comparison; member names, property names, literals, operators and operations
remain. This aids review and does not establish arbitrary identifier aliasing.

The company/group methods and role-field transforms remain structurally equal.
The detail GET, parameters and success transform remain the same. Its error
handler now passes an optional upstream message into router state for the same
422 `not-allowed` page. The listing UI continues its existing POST `allJobs`
method, while the separately published legacy GET `job?page=` endpoint map is
unchanged. Fresh public GET receipts independently confirmed that the adapter's
existing configuration/group/list/detail contract still responds for all four
correct employer identities. No POST was made during this investigation.

`test/test-data/darwinbox-current-client-20261105.json.gz` contains genuine public
shell/client/runtime bodies, response receipt metadata and opening/closing
native payloads. Tests explicitly distinguish retained October native/corporate
compatibility replays from current native payloads with retained corporate
scope. They do not label mixed fixtures as a fresh end-to-end source run.

Observed native totals were Keyence 4, Perfios 3, StanPlus 20 and Data Patterns 7.
Only Keyence's full opening/closing native snapshot was identical. The others
changed company alias values between reads; these remain closing coverage gaps.
Perfios's blank-description role and StanPlus's incomplete role criteria also
remain gaps. Current corporate content is not repinned here. Unknown main
clients fail; a known client with changed shell content or runtime declaration
retains jobs with incomplete source scope and no cleanup eligibility.

Validation: 13 new tests failed at the obsolete client gate before the fix;
all 76 new and retained focused tests passed after the fix. This release
selection change does not by itself certify complete current corporate scope.
