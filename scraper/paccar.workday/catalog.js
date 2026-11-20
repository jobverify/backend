import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "paccar",
  "companyName": "PACCAR",
  "adapter": "script",
  "atsPlatform": "successfactors-rmk",
  "countryFilter": "India",
  "companyCareerPage": "https://prod-cms.paccar.com/careers",
  "paginationStrategy": "current-own-corporate-handoff-and-native-India-result-pages-with-whole-listing-closing",
  "extractionStrategy": "exact-PACCAR-native-publisher+original-public-job-ID+whole-India-workplace+same-role-application-handoff",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Reads the current own PACCAR careers handoff and native RMK India publications. Native employer, whole workplace, original role identity, dates and own application handoff must reconcile. Explicit partials preserve company scope and cleanup holds; current counts require an actual runtime assessment.",
  "originalModulePath": "../workbookbatch09e/failClosedSentinel.js",
  "backfillMode": "live-parser",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
