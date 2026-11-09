import path from'node:path'
import{fileURLToPath}from'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "contrastsecurity",
  "companyName": "Contrast Security",
  "adapter": "script",
  "atsPlatform": "ashby",
  "boardToken": "contrast-security",
  "parser": "source-local-current-official-handoff-and-shared-Ashby-scoped-empty-guard",
  "companyDomain": "contrastsecurity.com",
  "companyCareerPage": "https://www.contrastsecurity.com/contrast-careers",
  "officialHomepageUrl": "https://www.contrastsecurity.com/",
  "jobsBoardUrl": "https://jobs.ashbyhq.com/contrast-security",
  "boardIdentityVerified": true,
  "officialBindingVerifiedAt": "2026-10-21T13:52:21.925Z",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "verificationDisposition": "diagnostic-current-empty-subboard-not-a-qualified-positive-repair",
  "zeroResultPolicy": "evidence-required",
  "sourceScopeComplete": false,
  "remediationStatus": "diagnostic-scoped-empty-future-positive-extraction-unverified",
  "backfillMode": "live-parser",
  "originalModulePath": null,
  "originalAdapter": null,
  "originalAtsPlatform": null,
  "countryFilter": "India",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "current-empty-public-native-board-and-Ashby-single-response-full-recheck",
  "extractionStrategy": "active-corporate-careers-handoff+exact-Ashby-organization+strict-shared-API-schema+empty-only-qualification",
  "bindingEvidence": {
    "verified": true,
    "checkedAt": "2026-10-21T13:52:21.925Z",
    "officialURL": "https://www.contrastsecurity.com/",
    "matchedLinks": [
      "https://www.contrastsecurity.com/contrast-careers",
      "https://jobs.ashbyhq.com/contrast-security"
    ],
    "bindingMethod": "current-active-corporate-career-native-anchors",
    "proofs": [
      {
        "file": "../artifacts/full-catalog/qualified-ats-021-001/001-contrastsecurity.json",
        "sha256": "7cd5bee791e93b264d433dbbae14eba5fc9c5fc8ee110464ade510a892be2afe"
      },
      {
        "file": "../artifacts/full-catalog/qualified-ats-021-001/002-contrastsecurity.json",
        "sha256": "b9e6fa8e2c867d488c96e60116b2dd3618ddd54cc11122697f36b34c3112d5bb"
      },
      {
        "file": "../artifacts/full-catalog/qualified-ats-021-001/003-contrastsecurity.json",
        "sha256": "f633f6febb057554adc700ebd4f4f2980b3ba660a5db3eb95314f471ad0b4064"
      }
    ]
  },
  "sourceScopeNotes": "Only the currently empty exact official-bound Ashby subboard is qualified; whole-company and India hiring scope remain unknown. Any new native role fails pending fresh full country/content/date/application qualification. Returned empty array always carries partial coverage evidence, never company-zero or cleanup authorization. No old/source count inheritance.",
  "verifiedSurfaceSummary": "Current corporate and careers pages actively bind exact Ashby contrast-security; current native identity and both empty surfaces are rechecked on every attempt. Runtime metadata counts remain null."
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export{PROVIDER_METADATA}
