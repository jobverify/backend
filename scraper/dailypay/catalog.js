import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "dailypay",
  "companyName": "DailyPay",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "current-own-declared-ashby-public-configured-board",
  "companyDomain": "dailypay.com",
  "companyCareerPage": "https://www.dailypay.com/careers/",
  "officialHomepageUrl": "https://www.dailypay.com/",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "countryFilter": "India",
  "paginationStrategy": "paired-current-own-filtered-jobs-connected-declared-embed-and-native-unfiltered-public-feed",
  "extractionStrategy": "original-native-publisher-state-account-roleID-country-and-application-qualified-configured-projection",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedGlobalJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Current own exact filtered jobs handoff, statically connected declared executable embed, native publisher/account and literal original state, and the documented anonymous public job-board feed must qualify in two passes. Every listed primary and secondary workplace needs consistent explicit foreign country evidence before a configured India projection of zero is accepted. Positive, unresolved, malformed, conflicting or changed native membership refuses empty proof. Country facets, whole company inventory, legal employing entities, renderer/application activation and cleanup remain unverified.",
  "backfillMode": "live-parser",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\dailypay.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
