import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "appzen",
  "companyName": "AppZen",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-lever-jobs-api",
  "companyCareerPage": "https://www.appzen.com/careers",
  "companyDomain": "appzen.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-public-jobs-api",
  "extractionStrategy": "verified-first-party-careers-embed+public-lever-jobs-api+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-01",
  "verificationDisposition": "verified-public-lever-jobs-api",
  "verifiedPublicJobCount": 22,
  "verifiedIndiaJobCount": 8,
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://www.appzen.com/careers remained the live exact-name AppZen careers surface, that it still embedded the public Lever account appzen, and that the corresponding public Lever board at https://jobs.lever.co/appzen plus https://api.lever.co/v0/postings/appzen?mode=json exposed a trustworthy public jobs inventory including India roles. The public Lever board footer now renders Powered by Lever instead of the older Jobs powered by Lever copy, while preserving the same public jobs contract. This scraper validates the verified first-party careers embed and public Lever board, then returns India jobs only from the public Lever API.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-lever-jobs-api",
  "originalModulePath": "../workbookbatch06/appzen.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\appzen.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
