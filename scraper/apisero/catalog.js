import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "apisero",
  "companyName": "APISero",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://apisero.com/",
  "companyDomain": "apisero.com",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-careers-jobs-and-about-routes-redirect-to-parent-about-page-validation",
  "extractionStrategy": "verified-exact-name-routes-redirect-to-parent-company-about-page-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://apisero.com/, https://apisero.com/careers, https://apisero.com/jobs, and https://apisero.com/about-us/ all redirected to the same parent-company corporate page at https://www.nttdata.com/en-us/about-us/. The shared redirect target exposed the NTT DATA About us surface with What we do, Who we are, Newsroom, and See career opportunities links rather than exact APISero public openings. This scraper now validates that redirect contract and returns zero jobs until a trustworthy exact APISero public careers surface reappears.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/apisero.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\apisero.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
