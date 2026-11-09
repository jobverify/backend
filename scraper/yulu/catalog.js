import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "yulu",
  "companyName": "Yulu",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "mynexthire",
  "companyCareerPage": "https://careers.yulu.bike/",
  "companyDomain": "careers.yulu.bike",
  "countryFilter": "India",
  "paginationStrategy": "single-page-public-mynexthire-requisition-list",
  "extractionStrategy": "verified-first-party-careers-shell+mynexthire-requisition-api",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-01",
  "verificationDisposition": "public-india-jobs-verified-locally",
  "verifiedPublicJobCount": 4,
  "verifiedIndiaJobCount": 4,
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://careers.yulu.bike/ remained the live Yulu first-party careers shell, that it embedded the public MyNextHire board at https://yulu.mynexthire.com/employer/jobs/careers, that the public board metadata stayed available at https://yulu.mynexthire.com/employer/jobboard/details_by_shortname/get/yulu/, and that the public requisition list endpoint at https://yulu.mynexthire.com/employer/careers/reqlist/get now returned 4 enumerable India openings including Full Stack Engineer, Assistant Manager - Refurb & Service Operations, and Learning Content Associate.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-shell-with-mynexthire-handoff-and-public-listing-error-fail-closed",
  "originalModulePath": "../workbookbatch06/yulu.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\yulu.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
