import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "bhive",
  "companyName": "Bhive",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "wordpress-rest-api",
  "companyCareerPage": "https://bhive.careers/jobs/",
  "companyDomain": "bhive.careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-first-party-jobs-page-plus-paged-wordpress-rest-api",
  "extractionStrategy": "verified-first-party-jobs-page+public-wordpress-jobs-api+embedded-taxonomies+india-location-normalization",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 17,
  "verifiedIndiaJobCount": 17,
  "wordPressJobsApiUrl": "https://bhive.careers/wp-json/wp/v2/jobs",
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://bhive.careers/jobs/ was the live first-party Bhive jobs page, that it exposed public role cards with a Load More workflow, and that the same first-party site published 17 live India openings through the public WordPress jobs API at https://bhive.careers/wp-json/wp/v2/jobs across Bangalore and Mumbai. This scraper validates the verified Bhive jobs shell and maps the embedded taxonomy terms from the public WordPress jobs API into normalized live India jobs.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "wordpress-rest-api",
  "originalModulePath": "../workbookbatch02/bhive.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\bhive.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
