import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
  "source": "bp",
  "companyName": "BP",
  "adapter": "script",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceDeadlineMs": 180000,
  "atsPlatform": "runtime-first-party-native-publication",
  "countryFilter": "India",
  "paginationStrategy": "independently-closed-current-own-published-surface-with-other-inventory-held",
  "extractionStrategy": "current-own-native-employer-workplace-identity-availability-and-authored-application-models",
  "parser": "custom-script",
  "backfillMode": "live-parser",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-published-partial-contract-company-inventory-and-cleanup-held",
  "verifiedSurfaceSummary": "Current separate own bp public careers home independently closes its published role cards. Same-role exact bp employer, explicit native India workplace and authored own Apply route qualify partial roles. Denied corporate/Workday origins remain unread; all other inventory, legal employer, backend activation and cleanup remain unverified.",
  "companyHomepage": "https://careers.bp.com/",
  "companyCareerPage": "https://careers.bp.com/",
  "officialOpeningsUrl": "https://careers.bp.com/"
}
PROVIDER_METADATA.modulePath=path.join(currentDir,'script.js')
PROVIDER_METADATA.dryRunFile=path.join(currentDir,'jobs.json')
export {PROVIDER_METADATA}
export default PROVIDER_METADATA
