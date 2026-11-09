import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "freshtime",
  "companyName": "Freshtime",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-exact-company-official-greencore-surface-with-no-enumerable-public-jobs-contract",
  "companyCareerPage": "https://www.greencore.com/ir-draft/why-invest-draft/strategy/freshtime/",
  "companyDomain": "greencore.com",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-company-official-greencore-surface+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-14",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Friday, August 14, 2026 that the previously reviewed Greencore Freshtime route at https://www.greencore.com/ir-draft/why-invest-draft/strategy/freshtime/ now returns the first-party title \"Page not found - Greencore\" with standard Greencore navigation including Careers and Work With Greencore, and no replacement exact-company public jobs contract was identified. The legacy Freshtime UK Limited entity remains dissolved, so this scraper stays fail-closed and returns no jobs until a trustworthy exact-company public openings surface reappears.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-company-official-greencore-surface-with-no-enumerable-public-jobs-contract",
  "originalModulePath": "../workbookbatch06/freshtime.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\freshtime.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
