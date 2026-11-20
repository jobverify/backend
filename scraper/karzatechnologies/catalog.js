import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "karzatechnologies",
  "companyName": "Karza Technologies",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "configured-Cutshort-exact-employer-publication",
  "countryFilter": "India",
  "paginationStrategy": "current-configured-company-and-explicit-same-company-native-alias-full-page-opening-closing",
  "extractionStrategy": "configured-native-long-name-and-own-website-employer-binding-direct-native-vacancy-JobPosting-country-and-role-profile-context",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-20",
  "verifiedSurfaceSummary": "The configured exact Karza Technologies native company profile explicitly declares a second current profile with the same own website and exact long company description. Direct-employer roles require matching native company IDs, native publication/schema identity, explicit job workplace country and a current same-role profile handoff, with whole public models reconciled at closing. All known criteria/date alternatives remain explicit partials. Agency/client and parent roles are not relabelled; complete company inventory, application controls and cleanup remain unqualified.",
  "backfillMode": "live-parser",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch03/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch03\\karzatechnologies.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
