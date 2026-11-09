import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "cmegroup",
  "companyName": "CME Group",
  "adapter": "script",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "all-advertised-Bangalore-native-location-facet-pages-and-stable-detail-recheck",
  "extractionStrategy": "exact-official-CME-Workday-board-and-strict-native-India-details",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "verified-official-native-board-runtime-inventory-separate",
  "verifiedSurfaceSummary": "Current official CME Group careers actively identifies cmegroup/cme_careers. Runtime validates complete native India descriptions and actual legal employers within the advertised Bangalore location facet; company-wide global and India totals remain unknown.",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
