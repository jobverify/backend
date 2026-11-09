import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "brainstormforce",
  "companyName": "Brainstorm Force",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-job-pages-and-branded-application-forms",
  "companyCareerPage": "https://brainstormforce.com/join/",
  "companyDomain": "brainstormforce.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-first-party-job-pages",
  "extractionStrategy": "verified-first-party-careers-page+same-origin-job-pages+branded-application-forms+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "verified-first-party-job-pages-and-branded-application-forms",
  "verifiedPublicJobCount": 2,
  "verifiedIndiaJobCount": 2,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://brainstormforce.com/join/ was the live exact-name Brainstorm Force careers surface, that it exposed public same-origin role pages under https://brainstormforce.com/join/, and that current India-targeted roles with working detail pages including Product Manager and Senior Laravel Developer handed applicants to Brainstorm Force application forms on https://forms.brainstormforce.com/. This scraper validates the verified first-party careers surface, keeps only India-tagged listings, and excludes stale cards that redirect away from their advertised detail pages.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-job-pages-and-branded-application-forms",
  "originalModulePath": "../workbookbatch06/brainstormforce.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\brainstormforce.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
