import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "allegion",
  "companyName": "Allegion",
  "adapter": "script",
  "atsPlatform": "workday",
  "parser": "current-corporate-handoff-and-source-local-workday-regional-enumerator",
  "catalogOverride": true,
  "companyDomain": "allegion.com",
  "companyCareerPage": "https://www.allegion.com/corp/en/careers.html",
  "officialHomepageUrl": "https://www.allegion.com/",
  "jobsBoardUrl": "https://allegion.wd5.myworkdayjobs.com/careers",
  "boardIdentityVerified": true,
  "officialBindingVerifiedAt": "2026-10-21T15:24:16.931Z",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "verificationDisposition": "verified-official-binding-runtime-separate",
  "zeroResultPolicy": "evidence-required",
  "remediationStatus": "implemented-awaiting-runtime-qualification",
  "backfillMode": "live-parser",
  "countryFilter": "India",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "source-local-advertised-Bangalore-all-pages-and-unique-stable-native-UID-recheck",
  "extractionStrategy": "active-corporate-handoff+source-local-UID-location-JD-validation+unchanged-shared-Workday-detail-mapping",
  "bindingEvidence": {
    "verified": true,
    "checkedAt": "2026-10-21T15:24:16.931Z",
    "officialURL": "https://www.allegion.com/corp/en/careers.html",
    "matchedLinks": [
      "https://allegion.wd5.myworkdayjobs.com/careers/jobs"
    ],
    "proofs": [
      {
        "file": "../artifacts/full-catalog/shared-ats-040-qualification-001/allegion-bangalore-008/001.json",
        "sha256": "cd990aa320d0579e3d35a710f198cc5ad783463f4e8a53dde748dfc77d9c6aeb"
      }
    ],
    "bindingMethod": "current-active-corporate-Explore-open-jobs-exact-Workday-site"
  },
  "sourceScopeNotes": "Only the explicitly advertised native Bangalore location facet is enumerated. Whole-company and all-India totals remain unknown. Separate current full-India research found an additional old Schlage Lock Company LLC Remote India role with Netherlands/Germany/Mexico secondaries; the earlier unchanged strict shared integration could not reconcile that mixed geography; this source-local enumerator retains the same explicit Bangalore subset. It remains outside this explicit regional subset, not silently discarded from a claimed complete board. All selected current native legal employers are Allegion India Private Limited. Current publication dates and native end dates remain unchanged. Browser used only for isolated research HTTP captures, never runtime fallback; ordinary runtime qualification is separate."
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export{PROVIDER_METADATA}
