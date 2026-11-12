Native reader cleanup regression (33 unchanged source-level cases)

From backend, after exact root-approved package creation:
  node --test --test-reporter=tap test/readerCleanupNative20261112.test.js

The .test.js wrapper is included by the existing npm test/test:api globs.
A full npm suite run is not claimed by the focused verification.

Node24 with permission mode and module.registerHooks is required. The ordinary
parent imports only Node builtins and pins the manifest, all14 module paths and
all19 exact read paths before and after its one strict child. The child imports
12 application modules and two trusted harness files. No report, absolute home,
environment-specific dependency, mutable source, external package, lazy PDF,
native implementation or capability grant is required. The historical11-base-
module diagnostic/comment in the unchanged proof is preserved; the helper makes
12 actual application imports. Proof and guard bytes are identical to approved
RED/GREEN; only portable paths/parent data validation are adapted.

The source child runs with --permission --disallow-code-generation-from-strings
--unhandled-rejections=strict and explicit TAP reporting. It has19 individual
file-read grants and no write/network/DB/browser/worker/addon/child grant. The
unchanged guard denies those boundaries and unexpected imports/reads/requests.
The parent removes NODE_OPTIONS, NODE_COMPILE_CACHE, NODE_TEST_CONTEXT and
NODE_PATH, records raw child stdout/stderr as base64 and the actual exit before
decoding, and writes no backend output files. A report-owned outer caller must
capture ordinary stdout/stderr/exit before parsing. Three exact fixture signature
pins, all12 application imports and all physical/unexpected/opaque counters are
verified by the parent as well as the unchanged case assertions.

Cases cover iProgrammer9, Calendly11 and Dataiku13 with actual Node standard
Response/ReadableStream/readers. Labelled authored transport errors include byte
overflow, reject/throw/pending/prompt cancellation, exact opaque external caller,
releaseLock, successful/errored EOF and Dataiku outward read/settle ownership.
Underlying-source controls and forwarding native-instance observations are the
only substitutions; application source, parser, policy, clocks, signals and
publisher facts are never replaced. Hardcoded genuine URLs are intercepted
entirely in memory; caller-selectable negatives use .invalid. Native15s/20s/120s/
180s expiry and generic runner/admission are not executed by this short suite.

Calendly uses unchanged retained27-packet bytes and consumes26 real source
requests. Its signature covers JSON-serializable jobs plus inventory and
nativeCollectionEvidence, recursively excluding scrapedAt/verifiedAt/observedAt/
startedAt/completedAt. This is not a symbol/nonenumerable object comparison.
The retained result has7 foreign roles, India0, jobs0, complete finite source
coverage, company-global scope false and lifecycle cleanup false. Dataiku uses
one retained HOME packet only: exact296975 UTF8 bytes, headers, digest, status,
final URL and actual reader release. It makes no whole-Dataiku job/country/source
qualification claim. Retained packets are prior evidence, not fresh acquisition.

There are33 unique cases. Repeating this retained package verifies portability;
its result must not be added to the original RED/GREEN as new unique coverage.
