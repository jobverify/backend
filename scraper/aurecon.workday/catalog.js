import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "aurecon",
  "companyName": "Aurecon",
  "adapter": "script",
  "atsPlatform": "workday",
  "companyCareerPage": "https://www.aurecongroup.com/careers/experienced-professionals",
  "countryFilter": "India",
  "paginationStrategy": "unfiltered-native-CXS-opening-and-closing-with-current-office-models",
  "extractionStrategy": "native-workday-countries+current-source-office-country-relations",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "verifiedInventoryStatus": "discovery-only",
  "verificationDisposition": "current-runtime-evidence-required",
  "verifiedSurfaceSummary": "Current native office-country relations are qualified at runtime. Configured board coverage, whole-company totals and cleanup require their own evidence.",
  "backfillMode": "workday",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
