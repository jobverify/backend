import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "damensch",
  "companyName": "DaMENSCH",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.damensch.com/about-us",
  "companyDomain": "damensch.com",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-plus-about-page-plus-branded-404-careers-and-jobs-routes-plus-storefront-pages-careers-shell-validation",
  "extractionStrategy": "verified-exact-name-homepage+verified-about-page+verified-missing-careers-and-jobs-routes+verified-storefront-pages-careers-shell-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://www.damensch.com/ served the official DaMENSCH storefront, https://www.damensch.com/about-us exposed the About Damensch Fashion That Thinks company page, https://www.damensch.com/careers and https://www.damensch.com/jobs both returned branded 404 Page not found responses, and https://www.damensch.com/pages/careers rendered a storefront shell with Experience the DaMENSCH Mobile App rather than public openings. This scraper now validates those exact no-public-careers surfaces and returns zero jobs until a trustworthy DaMENSCH public careers page appears.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/damensch.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\damensch.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
