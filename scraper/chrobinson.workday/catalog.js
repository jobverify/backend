import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "chrobinson",
  "companyName": "C.H. Robinson",
  "adapter": "script",
  "atsPlatform": "workday",
  "parser": "current-corporate-handoff-and-strict-shared-workday-union",
  "companyDomain": "chrobinson.com",
  "companyCareerPage": "https://www.chrobinson.com/en-us/about-us/careers/",
  "officialHomepageUrl": "https://www.chrobinson.com/",
  "jobsBoardUrl": "https://chrobinson.wd5.myworkdayjobs.com/CHRobinson",
  "boardIdentityVerified": true,
  "officialBindingVerifiedAt": "2026-10-21T12:59:47.265Z",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "verificationDisposition": "verified-official-native-binding-runtime-separate",
  "zeroResultPolicy": "evidence-required",
  "remediationStatus": "implemented-awaiting-local-independent-review",
  "backfillMode": "live-parser",
  "originalModulePath": null,
  "countryFilter": "India",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "shared-workday-native-India-facet-all-pages-with-current-total-and-detail-recheck",
  "extractionStrategy": "current-active-corporate-handoff+strict-shared-Workday-country-employer-identity-full-JD-date-validation",
  "bindingEvidence": {
    "verified": true,
    "checkedAt": "2026-10-21T12:59:47.265Z",
    "officialURL": "https://www.chrobinson.com/en-us/about-us/careers/",
    "matchedLinks": [
      "https://chrobinson.wd5.myworkdayjobs.com/CHRobinson/page/3e8b8b1707d61001a64a805e2ac80000"
    ],
    "bindingMethod": "current-corporate-talent-network-link-binds-exact-native-site-not-whole-company-inventory",
    "proofs": [
      {
        "file": "../artifacts/full-catalog/chrobinson-native-001/preflight-001.json",
        "sha256": "d8b3d3ebc8406d31c19c6ca1d779aad5c9b7b16f3ba28da9d84e8c4df26b418f"
      }
    ]
  },
  "sourceScopeNotes": "Only the explicit native India country facet is enumerated. Whole-company coverage and other recruitment surfaces remain unresolved. The corporate handoff is literally the talent-network signup to the same CHRobinson Workday site. Native full role identity and legal employer remain separate evidence; both the observed India private limited and Worldwide GmbH employers are retained verbatim. Native secondary office spelling and state labels remain unchanged; no company-country inference or duplicated alias inventory.",
  "verifiedSurfaceSummary": "Current corporate careers actively hands off to the exact Workday site; all selected native India roles are reconciled through the unchanged strict Workday union. Metadata contains no runtime counts."
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export{PROVIDER_METADATA}
