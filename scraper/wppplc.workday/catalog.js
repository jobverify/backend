import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
  "source": "wppplc",
  "companyName": "WPP plc",
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
  "verifiedSurfaceSummary": "Current corporate-declared native board publishes multiple agencies; only exact native WPP employer qualifies. Typed India or independently reviewed exact whole Mumbai workplace proof is retained with original country values. Subsidiaries/agencies, company inventories, backend activation and cleanup remain held.",
  "companyHomepage": "https://www.wpp.com/en",
  "companyCareerPage": "https://www.wpp.com/en/careers/search-and-apply",
  "officialOpeningsUrl": "https://wpp.careersitecloud.com/"
}
PROVIDER_METADATA.modulePath=path.join(currentDir,'script.js')
PROVIDER_METADATA.dryRunFile=path.join(currentDir,'jobs.json')
export {PROVIDER_METADATA}
export default PROVIDER_METADATA
