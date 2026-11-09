import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "smartshift",
  "companyName": "Smartshift",
  "officialBrandName": "SmartShift",
  "adapter": "script",
  "companyCareerPage": "https://www.smartshiftnow.com/",
  "companyDomain": "smartshiftnow.com",
  "atsPlatform": "verified-exact-name-public-company-surface",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-public-company-surface+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.smartshiftnow.com/ was the live exact-name SmartShift public company surface reviewed for Smartshift. Local repo evidence does not establish a stable enumerable public jobs contract, so this provider stays fail-closed until SmartShift publishes a trustworthy exact-name public openings surface.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface",
  "originalModulePath": "../workbookbatch04/smartshift.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\smartshift\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
