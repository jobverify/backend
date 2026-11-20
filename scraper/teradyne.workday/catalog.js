import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "teradyne",
  "companyName": "Teradyne",
  "adapter": "script",
  "atsPlatform": "successfactors-rmk",
  "countryFilter": "India",
  "companyCareerPage": "https://www.teradyne.com/careersatteradyne/",
  "paginationStrategy": "current-own-board-and-declared-India-keyword-result-pages-with-whole-native-row-closing",
  "extractionStrategy": "exact-Teradyne-brand-route+same-role-native-employer-and-whole-India-workplace+original-criteria-dates-and-own-application-link",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Reads the current own Teradyne careers handoff and declared native GET keyword search. The query is not an India country facet. Other published brands and foreign workplaces remain held; only exact Teradyne role routes with same-role employer, whole India workplaces and own application identity qualify. Original criteria and dates remain retained as explicit partials. Company totals, full application controls and cleanup require independent evidence.",
  "originalModulePath": "../workbookbatch09a/failClosedSentinel.js",
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
