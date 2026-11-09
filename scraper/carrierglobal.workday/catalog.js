import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
  "source": "carrierglobal",
  "companyName": "Carrier Global",
  "adapter": "script",
  "atsPlatform": "workday",
  "companyDomain": "carrier.com",
  "companyCareerPage": "https://www.carrier.com/us/en/careers/",
  "officialHomepageUrl": "https://www.carrier.com/us/en/",
  "jobsBoardUrl": "https://carrier.wd5.myworkdayjobs.com/jobs",
  "inventoryDelegation": {
    "verified": true,
    "verifiedAt": "2026-10-21T12:37:33.803Z",
    "sources": [
      "carrier"
    ],
    "preservesChildSourceAndCompany": true,
    "evidence": {
      "url": "https://www.carrier.com/us/en/privacy-notice/",
      "artifact": "artifacts/full-catalog/carrierglobal-delegation-001/relationship-proof-005.json",
      "sha256": "c6aff71b119d6eebe0d8fe5b9a4f57fef00a7e6c03cd709469d16326c34dc403"
    }
  },
  "countryFilter": "India",
  "paginationStrategy": "canonical-carrier-native-country-facet-all-pages-twice",
  "extractionStrategy": "current-group-identity-and-canonical-carrier-delegation-preserving-native-job-attribution",
  "parser": "current-group-identity-canonical-source-delegation",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "verificationDisposition": "verified-shared-group-recruitment-inventory-delegation",
  "zeroResultPolicy": "evidence-required",
  "remediationStatus": "implemented-awaiting-local-independent-review",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "verifiedSurfaceSummary": "Current corporate redirect and explicit official group-name definition connect Carrier Global to the same Carrier recruiting surface. This wrapper rechecks those relationships and delegates to the current canonical Carrier parser, preserving job.source carrier, company Carrier, every native legal employer and partial company scope. No separate employer or second inventory is created; legal parent/subsidiary entities are not asserted to be aliases."
}
PROVIDER_METADATA.modulePath=path.join(currentDir,'script.js')
PROVIDER_METADATA.dryRunFile=path.join(currentDir,'jobs.json')
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
