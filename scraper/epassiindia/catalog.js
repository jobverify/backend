import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "epassiindia",
  "companyName": "Epassi India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-jobylon-embed-and-detail-pages",
  "companyCareerPage": "https://www.epassi.com/careers",
  "companyDomain": "epassi.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-public-jobylon-embed",
  "extractionStrategy": "verified-first-party-careers-page+public-jobylon-embed+detail-pages+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-09",
  "verificationDisposition": "verified-public-jobylon-embed-and-detail-pages",
  "verifiedPublicJobCount": 17,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on 2026-10-09 that https://www.epassi.com/careers remains the first-party careers page, with Jobylon company id 2253 exposing 17 distinct Epassi vacancies across two complete embedded pages. All 17 public Jobylon details were fetched and their requisition URLs, titles, employer identities and country coverage verified; no public roles exposed India as a location. Sixteen roles publish European addresses. Requisition 389049 has an unpublished summary location and blank structured address, while its full role description explicitly states a full-time, Europe-based role. Ambiguous country coverage, identity drift, missing embedded pages and required-detail failures remain errors; collection limits remain incomplete.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-jobylon-embed-and-detail-pages",
  "originalModulePath": "../workbookbatch06/epassiindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\epassiindia.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
