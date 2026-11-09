import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "ciena",
  "companyName": "Ciena",
  "adapter": "script",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "all-native-India-facet-pages-and-stable-listing-detail-recheck",
  "extractionStrategy": "verified-official-Ciena-board-and-strict-shared-native-Workday-validation",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "verified-official-native-board-runtime-inventory-separate",
  "verifiedSurfaceSummary": "The current official career handoff identifies ciena/Careers. Runtime validates current native India roles, legal employers, complete descriptions and original dates. Whole-company scope and totals remain unknown.",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
