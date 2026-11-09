import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "blusmart",
  "companyName": "BluSmart",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://blusmart.com/",
  "companyDomain": "blusmart.com",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-plus-legacy-careers-alias-plus-missing-careers-route-validation",
  "extractionStrategy": "verified-exact-name-homepage+verified-legacy-careers-alias+verified-missing-careers-route-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://blusmart.com/ was the live exact-name BluSmart placeholder site, that the legacy careers alias at https://www.blusmart.in/careers resolved to the same BluSmart tablets shell with the visible info@blusmart.com and Facebook links, and that https://blusmart.com/careers returned a public 404 page instead of exposing trustworthy job listings. This provider now uses a verified exact-name no-public-careers scraper instead of a generic sentinel until BluSmart publishes a real public careers surface.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/blusmart.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\blusmart.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
