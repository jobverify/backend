import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "hoxhunt",
  "companyName": "Hoxhunt",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "current-own-declared-ashby-public-configured-board",
  "companyDomain": "hoxhunt.com",
  "companyCareerPage": "https://hoxhunt.com/careers",
  "officialHomepageUrl": "https://hoxhunt.com/",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "countryFilter": "India",
  "paginationStrategy": "paired-current-own-direct-native-board-and-unfiltered-documented-public-feed",
  "extractionStrategy": "original-native-publisher-state-account-roleID-country-and-application-qualified-configured-projection",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedGlobalJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Current own careers links, native publisher/account and literal original state, and the documented anonymous public job-board feed must qualify in two passes. Every listed primary and secondary workplace needs consistent explicit foreign country evidence before a configured India projection of zero is accepted. Positive, unresolved, malformed, conflicting or changed native membership refuses empty proof. Country facets, whole company inventory, legal employing entities, renderer/application activation and cleanup remain unverified.",
  "backfillMode": "live-parser",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\hoxhunt.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
