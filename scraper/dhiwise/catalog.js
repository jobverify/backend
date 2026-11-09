import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "dhiwise",
  "companyName": "DhiWise",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.dhiwise.com/careers",
  "companyDomain": "dhiwise.com",
  "atsPlatform": "verified-first-party-careers-empty-result",
  "countryFilter": "India",
  "paginationStrategy": "verified-careers-snapshot-empty-result",
  "extractionStrategy": "verified-first-party-careers-surface+zero-public-job-snapshot+return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://www.dhiwise.com/careers was the live first-party DhiWise careers surface, that it still advertised Available Spots, and that the public page content exposed no trustworthy public role listings beneath that heading. The same page also surfaced the current is now rocket.new transition link while still presenting DhiWise recruiting copy. The shared verified empty-state scraper returns this authoritative empty result; a future review must replace it with a parser before publishing jobs.",
  "backfillMode": "verified-empty-state",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-empty-result",
  "originalModulePath": "../workbookbatch04/verifiedCareersEmptyState.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\dhiwise.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
