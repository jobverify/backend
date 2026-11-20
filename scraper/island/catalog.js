import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "island",
  "companyName": "Island",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "own-webflow-declared-greenhouse-application",
  "countryFilter": "India",
  "paginationStrategy": "current-own-careers-cards-opening-and-closing;bounded-authored-India-role-proof",
  "extractionStrategy": "current-own-employer+same-role-authored-India-workplace+semantic-connected-native-ID-Greenhouse-loader;explicit-partials",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Reads current own corporate careers publications, authored same-role India workplace and the current connected native application-ID loader without executing JavaScript. Listing APAC labels and titles never supply country. Known criteria/dates and original responses are retained; full renderer, authentication, application controls/backend, company inventory and cleanup remain unverified.",
  "backfillMode": "live-parser",
  "authoritativeCurrentPublication": true,
  "companyCareerPage": "https://www.island.io/careers",
  "scraperTimeoutMs": 240000,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\island.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
