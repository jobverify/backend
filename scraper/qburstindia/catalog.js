import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "qburstindia",
  "companyName": "Qburst India",
  "officialBrandName": "QBurst",
  "adapter": "script",
  "companyCareerPage": "https://www.qburst.com/en-in/company/career/",
  "companyDomain": "qburst.com",
  "atsPlatform": "official-company-careers-empty-openings",
  "countryFilter": "India",
  "paginationStrategy": "verified-empty-openings-or-browser-detail-navigation",
  "extractionStrategy": "first-party-careers-empty-openings-or-browser-detail-pages",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-04",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Tuesday, August 4, 2026 that https://www.qburst.com/en-in/company/career/ was the live QBurst India first-party careers landing page with search controls, while https://www.qburst.com/en-in/company/career/openings/ presented an empty public openings state reading \"Open Positions\" and \"We need people like you. Submit your resume for future opportunities.\" with a \"Submit Resume\" action and no visible /job-details/ links.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface",
  "originalModulePath": "../workbookbatch04/qburstindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\qburstindia\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
