import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "trell",
  "companyName": "Trell",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.linkedin.com/company/trell/",
  "atsPlatform": "verified-linkedin-company-page-plus-public-india-jobs-search",
  "paginationStrategy": "single-public-linkedin-india-search",
  "extractionStrategy": "verified-linkedin-company-page+public-india-jobs-search+india-filter",
  "verifiedOn": "2026-08-02",
  "verifiedSurfaceSummary": "Verified on Sunday, August 2, 2026 that direct access to https://trell.co/ timed out during live checks, but the public LinkedIn company page at https://www.linkedin.com/company/trell/ remained accessible and identified Trell via urn:li:organization:10796691, its public company description, and its website field pointing to https://trell.co/. The public LinkedIn India jobs search at https://www.linkedin.com/jobs/search/?f_C=10796691&geoId=102713980 returned \"We couldn’t find a match\" with zero India jobs on the verified date. This scraper validates that current public LinkedIn contract and returns India jobs only when the public search exposes them.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-surface-fail-closed-sentinel",
  "originalModulePath": "../workbookbatch05/trell.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
