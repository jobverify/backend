import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "basepair",
  "companyName": "Basepair",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-empty-result",
  "companyCareerPage": "https://www.basepairtech.com/careers/",
  "companyDomain": "basepairtech.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-careers-snapshot-empty-result",
  "extractionStrategy": "verified-first-party-careers-surface+zero-public-job-snapshot+return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://www.basepairtech.com/careers/ was the live first-party Basepair careers page, and that its public Current Positions section exposed no active job listings while explicitly telling candidates that if there are no open positions they can still email careers@basepairtech.com with a resume and cover letter. This provider now uses the verified first-party empty-state scraper instead of a generic sentinel until Basepair publishes real public openings on its official careers surface.",
  "backfillMode": "verified-empty-state",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-empty-result",
  "originalModulePath": "../workbookbatch04/verifiedCareersEmptyState.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\basepair.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
