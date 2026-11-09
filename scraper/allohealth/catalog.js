import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "allohealth",
  "companyName": "Allo Health",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://airtable.com/app3JO79fwEz4srgJ/shrD53PpCm2BKq5O9",
  "teamFormUrl": "https://airtable.com/app3JO79fwEz4srgJ/shrD53PpCm2BKq5O9",
  "companyDomain": "allohealth.com",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-plus-about-page-plus-team-form-and-missing-careers-route-validation",
  "extractionStrategy": "verified-exact-name-homepage+verified-team-intake+verified-about-page+verified-missing-careers-route-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on October 3, 2026 that https://www.allohealth.com/ and https://www.allohealth.com/about remain first-party Allo Health pages, while the homepage now links Join Our Team to https://airtable.com/app3JO79fwEz4srgJ/shrD53PpCm2BKq5O9, a general application form. The first-party https://www.allohealth.com/careers route and its non-www alias still show branded 404 pages. No first-party public job listings are exposed by these checked surfaces, so this source returns zero jobs while the handoff and missing-route checks hold.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/allohealth.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\allohealth.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
