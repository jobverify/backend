import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "onsemiconductor",
  "companyName": "ON Semiconductor",
  "adapter": "script",
  "companyDomain": "onsemi.com",
  "officialHomepageUrl": "https://www.onsemi.com/careers",
  "companyCareerPage": "https://www.onsemi.com/careers",
  "publisherNames": ["onsemi"],
  "atsPlatform": "oracle-candidate-experience",
  "countryFilter": "India",
  "paginationStrategy": "native-keyword-candidate-offset",
  "extractionStrategy": "current-corporate-rebrand-and-native-site-delegation-own-country-full-role-criteria",
  "parser": "runtime-verified-recruitment",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-10",
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "lifecycleCleanupAllowed": false,
  "requireCorporateIdentityMatch": true,
  "requireNativeEmployerName": false,
  "verificationDisposition": "runtime-verified-recruitment-source-scope-unverified",
  "verifiedSurfaceSummary": "Current company history explicitly binds ON Semiconductor to publisher brand onsemi. Current careers delegates the native Oracle CX_1001 site. Only own explicit India country and substantive external criteria qualify; legal employer remains unknown where the native label is null. Keyword inventory is not a company or India total; cleanup remains forbidden.",
  "originalModulePath": "../workbookbatch09b/failClosedSentinel.js",
  "backfillMode": "workday",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
