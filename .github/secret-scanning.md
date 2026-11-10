# Secret scanning

`security.yml` runs Gitleaks 8.30.1 against the exported tracked tree and all
fetched Git history. Default detection rules remain enabled; inline allow
comments are ignored. New findings and scanner/report errors fail the job.

`secret-scan-exceptions.json` records reviewed matches using a detection rule,
SHA256 of the exact detected value, an explicit list of repository-relative
files, and a review reason. All three identifying fields must match. Line
numbers and commits are intentionally not used as exceptions: moving code
within a reviewed file is safe, but changing the value, file, or rule requires
another review. There are no directory exclusions or automatic baselines.

The initial review covers public careers-site browser identifiers, widget
and telemetry configuration, record identifiers, checksums, HTML labels, and
synthetic test inputs. Older paths are listed individually for history scans.
Public browser values are not necessarily read-only: the captured LAVA client
contains a public application-submission key. ReBIT's historical password is
an anonymous browser bootstrap binding. Matter's historical Azure integration
key was verified in its published careers JavaScript. These exceptions do not
approve private user credentials or arbitrary replacement keys. Signed S3
asset URLs contain temporary access identifiers, not AWS secret signing keys;
their review reasons record the specific captured authorization and expiry.

The 2026-11-01 review extends the existing Greenhouse browser-value exceptions
to the two Biofourmis capture files, including the historical HTTP capture.
It also covers the Byteridge/Monocept `publicMethodSHA256` checksums, the
Excelacom Dropbox Chooser browser app key, the historical outreach model-cache
labels, and the isolated outreach integration test's synthetic JWT value.
These entries still require the exact rule, file, and detected-value digest;
replacement values and additional findings in those files remain blocked.

Exact comparison requires raw values locally. The workflow creates private
temporary reports with `umask 077`, suppresses scanner output, and passes the
reports directly to `filterSecretScan.js`. The filter never logs values, source
matches, authors, or commit messages. It writes only unresolved rule/file/line/
commit metadata and deletes the raw input, including on errors. A shell exit
trap also removes the raw report if processing is interrupted. Only the
metadata reports are uploaded; raw reports must never become artifacts.

To investigate a new finding, inspect its actual source and intended use in
a private local report. Revoke/rotate genuine exposed credentials and remove
them from tracked files. Do not add an exception merely because a value is
already in history or appears under `fixtures`. For a confirmed public or
synthetic value, hash the exact scanner `Secret` bytes and add only the
reviewed rule and file paths, with a specific reason. Never generate an
exception list automatically from all current findings.

Run `node --test test/filterSecretScan.test.js` after changing scan handling,
then rerun both Gitleaks modes using the workflow's filtering steps. The tests
cover replacement credentials, additional findings in a reviewed fixture,
moved values, changed rules, invalid paths, malformed input, scanner errors,
raw-report cleanup, and metadata-only output.

The 2026-11-03 review covers Paylocity's anonymous public board UUID, the
Alkem TurboHire public-method checksum, public capture-manifest lookup labels
for Akulaku, Bikayi, Bounteous and BillEase, and the exact Capsitech browser
position-category value captured from `window.RESUME_KEY`. It also covers the
Claroty manifest's literal limitation prose `persistence/publication`. These
entries retain the rule + exact file + detected-value SHA256 matching policy;
new credentials and replacement values remain blocked.

The 2026-11-07 review covers the exact Qualified widget and BugHerd embed
identifiers declared in the LangChain careers capture manifest. Both script
URLs occur in the captured corporate HTML, whose digest matches its receipt.
It also covers the Workline fixture's public CandidatePortal job UUID, which
must match the captured role URL, and the synthetic JWT signing secret assigned
inside the isolated account and payment test, including its historical copy.
These four entries are restricted to their exact detected-value hashes, the
`generic-api-key` rule, and the three individually reviewed file paths. Browser
identifiers and test inputs in other files still require their own review.

The same review covers the Chronus public Recruiterbox client's SHA256
integrity pin and the synthetic publishing and JWT values used by the isolated
public-budget and SEO route tests. Each entry retains the exact rule, file,
and detected-value digest restriction.

The 2026-11-09 review covers seven historical provider metadata matches: the
Astellas public SuccessFactors response integrity pin; BP, Fifth Third,
Crown Holdings and Equinor public Workday board identities; Calbee's public
Sonar ATS board identity; and Etihad Airways' public SmartRecruiters company
identifier. Their field definitions and public board bindings were checked in
the historical source. Each exception applies only to its exact detected-value
digest, `generic-api-key` rule, and individually listed historical JSON path.
New values and matches in other files remain blocked.
