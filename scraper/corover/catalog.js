import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "corover",
  "companyName": "CoRover",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-same-origin-detail-pages",
  "companyCareerPage": "https://corover.ai/company/careers",
  "companyDomain": "corover.ai",
  "countryFilter": "India",
  "paginationStrategy": "single-first-party-careers-page",
  "extractionStrategy": "verified-first-party-careers-page+public-visible-job-cards+same-origin-detail-pages+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 4,
  "verifiedIndiaJobCount": 4,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://corover.ai/company/careers was the live first-party CoRover careers page, that it publicly listed 4 same-origin openings including Program Manager - Technology / IT, Executive Assistant/Admin, Principal Research Scientist - Advanced Foundations & Frontier Intelligence, and Full Stack Developer, and that each role resolved to a same-origin public detail page under /company/careers/{slug} with visible overview metadata plus an on-page application form. This scraper validates that verified careers shell and same-origin detail contract, then returns the current India jobs from CoRover's official public surface.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-same-origin-detail-pages",
  "originalModulePath": "../workbookbatch02/corover.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\corover.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
