import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "arivihan",
  "companyName": "Arivihan",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.arivihan.com/about",
  "companyDomain": "arivihan.com",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-plus-about-page-plus-missing-careers-route-validation",
  "extractionStrategy": "verified-exact-name-homepage+verified-about-page+verified-missing-careers-route-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-01",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://www.arivihan.com/ still exposed Arivihan's official homepage surface with the same exact title and primary navigation, that https://www.arivihan.com/about still exposed the About Us and Our Mission sections for Arivihan's automated vernacular online learning platform, and that https://www.arivihan.com/careers plus https://arivihan.com/careers both continued returning public 404 pages instead of exposing trustworthy job listings. This provider stays on the verified no-public-careers scraper until Arivihan publishes a real public careers surface.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/arivihan.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\arivihan.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
