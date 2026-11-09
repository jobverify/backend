import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "housr",
  "companyName": "Housr",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-same-origin-detail-pages",
  "companyCareerPage": "https://housr.in/career",
  "companyDomain": "housr.in",
  "countryFilter": "India",
  "paginationStrategy": "verified-first-party-job-pages",
  "extractionStrategy": "verified-first-party-careers-page+same-origin-detail-pages+next-data-payload+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verificationDisposition": "verified-first-party-same-origin-job-pages",
  "verifiedPublicJobCount": 9,
  "verifiedIndiaJobCount": 9,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://housr.in/career was the live first-party Housr careers page, that it publicly listed 9 same-origin openings under /career/{jobId}, and that detail pages such as https://housr.in/career/4 exposed trustworthy job descriptions plus Apply with LinkedIn handoffs for current India roles including Assistant Resident Manager/Resident Manager (Bangalore & Pune). This scraper validates the verified Housr careers shell and same-origin detail payloads, then returns the current India jobs from the official public surface.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-same-origin-detail-pages",
  "originalModulePath": "../workbookbatch03/housr.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch03\\housr.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
