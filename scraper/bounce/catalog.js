import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "bounce",
  "companyName": "Bounce",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://bounce-v2.bounceinfinity.com/about.html",
  "companyDomain": "bounceinfinity.com",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-plus-legacy-about-page-plus-missing-careers-route-validation",
  "extractionStrategy": "verified-exact-name-homepage+verified-legacy-about-page+verified-missing-careers-route-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://bounceinfinity.com/ was the live first-party Bounce Infinity product homepage, that the legacy public company page at https://bounce-v2.bounceinfinity.com/about.html still exposed the Bounce founder and story surface with Vivekananda Hallekere, Anil, and Varun Agni, and that https://bounceinfinity.com/careers returned a public 404 with no public openings. This scraper validates those exact surfaces and returns zero jobs until first-party public role listings appear.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/bounce.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\bounce.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
