import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "wingify",
  "companyName": "Wingify",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-keka-and-teamtailor-public-inventories",
  "companyCareerPage": "https://wingify.com/company/careers/",
  "companyDomain": "wingify.com",
  "countryFilter": "India",
  "paginationStrategy": "complete-public-keka-array-and-teamtailor-board-rss-reconciliation",
  "extractionStrategy": "verified-composite-handoff+strict-public-details+explicit-country-scope+partial-inventory-evidence",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-08",
  "verificationDisposition": "verified-india-subset-with-unresolved-upstream-country-conflict",
  "verifiedPublicJobCount": 31,
  "verifiedIndiaJobCount": 16,
  "sourceListingComplete": false,
  "unresolvedJobIds": ["136690"],
  "verifiedSurfaceSummary": "Verified on October 8, 2026 that the current Wingify careers feed hands off to Wingify Keka and AB Tasty Teamtailor. Complete public ATS inventories and all 31 details reconcile: 16 confirmed India, 14 explicit foreign, and Keka 136690 with conflicting Latin America/IN geography. Every returned India job is marked sourceListingComplete:false until this conflict resolves.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-keka-jobs-api",
  "originalModulePath": "../workbookbatch06/wingify.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\wingify.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
