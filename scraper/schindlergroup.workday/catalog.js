import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "schindlergroup",
  "companyName": "Schindler Group",
  "adapter": "script",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceDeadlineMs": 180000,
  "atsPlatform": "runtime-first-party-native-publication",
  "countryFilter": "India",
  "paginationStrategy": "current-native-declared-pagination-with-finite-partial-inventory",
  "extractionStrategy": "current-own-native-employer-country-role-publication-and-application-models",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-published-partial-contract-company-inventory-and-cleanup-held",
  "verifiedSurfaceSummary": "Current corporate-declared native publication models qualify own India partial roles. Unknown or other employers/countries remain held; full company inventory, legal employer, ATS activation and cleanup remain unverified.",
      "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
