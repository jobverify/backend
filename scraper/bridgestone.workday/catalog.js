import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "bridgestone",
  "companyName": "Bridgestone",
  "adapter": "script",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceDeadlineMs": 180000,
  "atsPlatform": "runtime-first-party-native-publication",
  "countryFilter": "India",
  "paginationStrategy": "two-pass-current-native-configured-search-zero-only-company-inventory-held",
  "extractionStrategy": "current-corporate-declared-India-location-query-and-typed-native-zero-only",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "configured-query-only-current-native-zero-contract-company-inventory-and-cleanup-held",
  "verifiedSurfaceSummary": "Two current native typed zero responses qualify only the corporate-declared India location search. India country facet and company all-channel inventory remain unverified; company totals, legal employer, application activation and cleanup remain held. Positive or changed native models require separate qualification.",
      "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
