import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zimyo",
  "companyName": "Zimyo",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-empty-result",
  "companyCareerPage": "https://www.zimyo.com/about/career/",
  "companyDomain": "zimyo.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-careers-snapshot-empty-result",
  "extractionStrategy": "verified-first-party-careers-surface+zero-public-job-snapshot+return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://www.zimyo.com/about/career/ was the live first-party Zimyo careers page, and that its public Job Openings section exposed no active job listings while directing candidates to career@zimyo.com instead. This provider now uses the verified first-party empty-state scraper instead of a generic sentinel until Zimyo publishes real public openings on its official careers surface.",
  "backfillMode": "verified-empty-state",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-empty-result",
  "originalModulePath": "../workbookbatch04/verifiedCareersEmptyState.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\zimyo.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
