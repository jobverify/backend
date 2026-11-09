import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "foraysoft",
  "companyName": "ForaySoft",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-stale-third-party-jobs-archive-fail-closed",
  "companyCareerPage": "https://www.foraysoft.com/careers.html",
  "companyDomain": "foraysoft.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-first-party-same-origin-jobs-archive",
  "extractionStrategy": "verified-first-party-careers-page+stale-third-party-jobs-archive+fail-closed",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.foraysoft.com/careers.html was the live first-party ForaySoft careers surface and that https://www.foraysoft.com/jobs/ plus https://www.foraysoft.com/jobs/?p=2 exposed a same-origin public jobs archive. The reviewed archive consisted of third-party placement roles such as Salesforce Support Engineer - Bezons, Tech Java Developer - Atos, Java Full Stack Developer - Xebia, SAP Consultant- KPMG, and D365, F&O Technical - Robert Bosch rather than trustworthy exact-company ForaySoft openings, and the visible Posted on markers were already stale on Saturday, July 25, 2026, with the newest reviewed archive dates still in September and October 2021. No trustworthy current exact-company public jobs contract was verified for ForaySoft, so this company-local scraper stays fail-closed and returns no jobs until a stable exact-company openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-stale-third-party-jobs-archive-fail-closed",
  "originalModulePath": "../workbookbatch06/foraysoft.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\foraysoft.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
