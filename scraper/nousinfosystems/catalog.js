import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
  "source": "nousinfosystems",
  "companyName": "Nous Infosystems",
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
  "verifiedSurfaceSummary": "Current affirmative Nous-to-Artizent rename and own published roles; only exact whole independently reviewed municipal India workplaces qualify. Ambiguous Hyderabad remains held. Legal employer, full forms/backend, company inventories and cleanup remain unverified.",
  "companyHomepage": "https://www.artizent.com/",
  "companyCareerPage": "https://www.artizent.com/insights/careers",
  "officialOpeningsUrl": "https://www.artizent.com/insights/careers/openings",
  "officialBrandName": "Artizent",
  "homepageUrl": "https://www.nousinfosystems.com/",
  "legacyHomepageRedirectUrl": "https://www.artizent.com/"
}
PROVIDER_METADATA.modulePath=path.join(currentDir,'script.js')
PROVIDER_METADATA.dryRunFile=path.join(currentDir,'jobs.json')
export {PROVIDER_METADATA}
export default PROVIDER_METADATA
