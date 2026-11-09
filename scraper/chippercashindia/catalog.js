import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "chippercashindia",
  "companyName": "Chipper Cash India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-pages-with-stale-same-origin-openings-fail-closed",
  "companyCareerPage": "https://www.chippercash.com/careers",
  "companyDomain": "chippercash.com",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-first-party-careers-pages+stale-same-origin-openings+past-deadline-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-01",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://www.chippercash.com/careers was the live first-party Chipper Cash careers surface, that https://www.chippercash.com/career-current-openings still exposed only one same-origin role link for RISK AND COMPLIANCE OFFICER/ASSOCIATE RWANDA, and that the linked public role page still carried an application deadline of February 24, 2026, which was already in the past on Saturday, August 1, 2026. Because the reviewed first-party openings inventory remained stale and non-India, no trustworthy current public jobs contract was verified for Chipper Cash India, so this company-local scraper stays fail-closed and returns no jobs until a stable current openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-pages-with-stale-same-origin-openings-fail-closed",
  "originalModulePath": "../workbookbatch06/chippercashindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\chippercashindia.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
