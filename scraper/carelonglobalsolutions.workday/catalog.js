import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "carelonglobalsolutions",
  "companyName": "Carelon Global Solutions",
  "adapter": "script",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "native-regional-board-all-pages-with-stable-native-recheck",
  "extractionStrategy": "current-official-India-handoff-and-strict-shared-Workday-detail-validation",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "verified-official-regional-binding-runtime-separate",
  "verifiedSurfaceSummary": "Current Carelon India regional corporate handoff and native full Workday roles are checked each run. Whole-company and parent Elevance coverage remain unknown. Runtime counts remain separate.",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
