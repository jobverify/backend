import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "commonwealthbankofaustralia",
  "companyName": "Commonwealth Bank of Australia",
  "adapter": "script",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "all-current-native-India-country-facet-pages-with-full-final-listing-recheck",
  "extractionStrategy": "verified-current-official-CommBank-board-and-full-native-India-details",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "verified-official-native-board-runtime-inventory-separate",
  "verifiedSurfaceSummary": "The current official CommBank India page actively identifies cba/CommBank_Careers and its India country facet. Runtime validates original native dates, full descriptions, legal employer and application status across every selected page. Whole-company global and India counts remain unknown.",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
