import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "hightouch",
  "companyName": "Hightouch",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "ashby",
  "companyCareerPage": "https://hightouch.com/careers",
  "authoritativeCurrentPublication": true,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "scraperTimeoutMs": 180000,
  "countryFilter": "India",
  "paginationStrategy": "paired-current-own-and-native-complete-listed-membership",
  "extractionStrategy": "current-own-Next-connected-native-advertised-India-projection",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Current own careers cards and Next route data bind the advertised listed inventory to a role-specific native account. Paired native board and documented unfiltered feed observations qualify only the configured India projection; missing countries remain null. Company totals, legal employer and cleanup remain unverified.",
  "backfillMode": "live-parser",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\hightouch.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
