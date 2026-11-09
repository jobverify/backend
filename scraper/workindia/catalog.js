import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "workindia",
  "companyName": "WorkIndia",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-exact-name-public-surface-fail-closed",
  "companyCareerPage": "https://www.workindia.in/",
  "companyDomain": "workindia.in",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-public-company-surface+company-specific-fail-closed-wrapper",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.workindia.in/ was the live official public surface reviewed for WorkIndia. The verified public surface presents WorkIndia as a broad job marketplace with public city and job-detail pages rather than a trustworthy exact-company careers contract for WorkIndia itself, and the reviewed surface does not establish a stable enumerable public jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy official openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-surface-fail-closed",
  "originalModulePath": "../workbookbatch06/workindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\workindia.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
