import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "slanglabs",
  "companyName": "Slang Labs",
  "officialBrandName": "Slang Labs",
  "adapter": "script",
  "companyCareerPage": "https://slangapp.com/careers",
  "companyDomain": "slangapp.com",
  "atsPlatform": "verified-first-party-careers-empty-result",
  "countryFilter": "India",
  "paginationStrategy": "verified-careers-snapshot-empty-result",
  "extractionStrategy": "verified-first-party-careers-surface+zero-public-job-snapshot+return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://slangapp.com/careers was the live first-party careers surface for Slang Labs and exposed zero trustworthy public jobs. The dedicated batch-04 snapshot scraper returns this authoritative empty result; a future review must replace it with a parser before publishing jobs.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "verified-empty-state",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-empty-result",
  "originalModulePath": "../workbookbatch04/verifiedCareersEmptyState.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\slanglabs\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
