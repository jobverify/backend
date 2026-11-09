import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA = {
  "source": "aventior",
  "companyName": "Aventior",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-linkedin-company-validation-and-public-jobs-search",
  "companyCareerPage": "https://www.aventior.com/careers",
  "companyDomain": "aventior.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-public-jobs-search",
  "extractionStrategy": "verified-first-party-careers-page+verified-linkedin-company-scope+bounded-guest-cards+India-filter+discovery-only-empty+partial-inventory",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "verificationDisposition": "discovery-only-company-scoped-guest-query",
  "verifiedSurfaceSummary": "Current official Aventior careers handoff and LinkedIn company filter f_C=27234995 are verified. Public guest search now says it could not find a match for Aventior jobs in Worldwide. Complete employer inventory is unverified; zero carries discovery-only evidence and any returned India rows are marked incomplete.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-linkedin-company-validation-and-public-jobs-search",
  "originalModulePath": "../workbookbatch06/aventior.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\aventior.jobs.json",
  "zeroResultPolicy": "discovery-only"
}
export default PROVIDER_METADATA
export { PROVIDER_METADATA }
