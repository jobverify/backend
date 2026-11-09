import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zluri",
  "companyName": "Zluri",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-keka-embedjobs-api",
  "companyCareerPage": "https://www.zluri.com/careers",
  "companyDomain": "zluri.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-public-jobs-api",
  "extractionStrategy": "verified-first-party-careers-embed+public-keka-embedjobs-api+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-02",
  "verificationDisposition": "verified-public-keka-embedjobs-api",
  "verifiedPublicJobCount": 10,
  "verifiedIndiaJobCount": 5,
  "verifiedSurfaceSummary": "Verified on Sunday, August 2, 2026 that https://www.zluri.com/careers remained the live Zluri first-party careers surface, that it still embedded the public Keka jobs widget from https://zluri.keka.com/careers/api/embedjobs/js/ed2b6b25-be74-43f1-9a38-c3bf27b9146c, and that https://zluri.keka.com/careers/api/embedjobs/default/active/ed2b6b25-be74-43f1-9a38-c3bf27b9146c still exposed India roles including Bangalore openings. This scraper validates those verified surfaces and returns India jobs only from the public Keka payload.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-keka-embedjobs-api",
  "originalModulePath": "../workbookbatch06/zluri.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\zluri.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
