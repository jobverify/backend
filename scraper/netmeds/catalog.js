import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "netmeds",
  "companyName": "Netmeds",
  "officialBrandName": "Netmeds",
  "adapter": "script",
  "companyCareerPage": "https://www.netmeds.com/",
  "companyDomain": "netmeds.com",
  "atsPlatform": "reliance-retail-rcareers-odata",
  "countryFilter": "India",
  "paginationStrategy": "single-business-search-via-public-odata",
  "extractionStrategy": "verified-homepage-handoff+public-odata-job-search+zero-or-live-netmeds-results",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-03",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Monday, August 3, 2026 that https://www.netmeds.com/ remained the live Netmeds exact-name public company surface, that its footer Career link handed applicants to the public Reliance Retail careers portal at https://rcareers.ril.com/sap%28bD1lbiZjPTQ0OQ==%29/bc/bsp/sap/zerec_home_page/home_page.do, and that the live Netmeds business search there returned zero current public openings. This scraper now validates the homepage-to-RCareers handoff and returns the portal's current Netmeds jobs when they exist.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface",
  "originalModulePath": "../workbookbatch04/netmeds.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\netmeds\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
