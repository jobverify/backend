import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "cochlear",
  "companyName": "Cochlear",
  "adapter": "script",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "all-selected-native-location-facet-pages-with-final-recheck",
  "extractionStrategy": "verified-official-Cochlear-board-strict-current-native-India-full-details",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "verified-official-native-board-runtime-inventory-separate",
  "verifiedSurfaceSummary": "The current official careers page identifies cochlear/Cochlear_Careers. Runtime checks four advertised India location filters, original dates, native legal employers and full descriptions. Whole-company global and India counts remain unknown.",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
