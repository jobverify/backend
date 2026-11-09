import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "cargill",
  "companyName": "Cargill",
  "adapter": "script",
  "atsPlatform": "successfactors-rmk",
  "countryFilter": "India",
  "paginationStrategy": "native-India-country-filter-all-pages-plus-full-recheck",
  "extractionStrategy": "current-official-Talentbrew-to-SAP-RMK-full-native-detail",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "verified-official-native-binding-runtime-separate",
  "verifiedSurfaceSummary": "Current official Cargill India-country-filter inventory and full SAP/RMK roles are checked each run. Whole-company scope remains partial; runtime metadata counts remain unknown.",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
