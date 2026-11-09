import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "photomathindia",
  "companyName": "Photomath India",
  "officialBrandName": "Photomath",
  "adapter": "script",
  "companyCareerPage": "https://www.photomath.com/careers/",
  "companyDomain": "photomath.com",
  "atsPlatform": "official-company-careers-parent-handoff",
  "countryFilter": "India",
  "paginationStrategy": "redirect-handoff-sentinel",
  "extractionStrategy": "verified-homepage+google-careers-handoff+fail-closed",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-01",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://www.photomath.com/ was the live Photomath brand surface and that its /careers/ route redirected to the generic Google Careers applications hub rather than an exact-company public jobs inventory for Photomath India.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface",
  "originalModulePath": "../workbookbatch04/photomathindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\photomathindia\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
