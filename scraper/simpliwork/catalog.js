import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "simpliwork",
  "companyName": "Simpliwork",
  "officialBrandName": "Simpliwork",
  "adapter": "script",
  "companyCareerPage": "https://simpliwork.com/careers/",
  "companyDomain": "simpliwork.com",
  "atsPlatform": "current-own-SSR-vacancy-cards-published-resume-email",
  "countryFilter": "India",
  "paginationStrategy": "bounded-own-publisher-and-complete-native-card-opening-closing-observations",
  "extractionStrategy": "current-own-careers-declaration+native-SSR-title-workplace-application-card+independent-whole-municipal-proof+valid-partials",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedGlobalJobCount": null,
  "verifiedIndiaJobCount": null,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "verifiedSurfaceSummary": "Current own Simpliwork homepage declares its current careers roster. Exact native unique card title, whole role workplace and original same-card resume email qualify in opening/closing observations. Independent official municipal references qualify exact whole Bengaluru/Bangalore, Gurugram and Noida workplace alternatives. Unknown workplaces remain held. Authored criteria/dates are preserved as partial; native public requisition IDs, legal employer, full company inventory, email activation/backend and cleanup remain unverified.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-parser",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-surface-fail-closed",
  "originalModulePath": "../workbookbatch04/simpliwork.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\simpliwork\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
