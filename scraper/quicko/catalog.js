import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "quicko",
  "companyName": "Quicko",
  "officialBrandName": "Quicko",
  "adapter": "script",
  "companyCareerPage": "https://quicko.com/",
  "companyDomain": "quicko.com",
  "atsPlatform": "verified-exact-name-public-surface-fail-closed",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-public-company-surface+company-specific-fail-closed-wrapper",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://quicko.com/ was the live exact-name Quicko public company surface reviewed for Quicko. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-surface-fail-closed",
  "originalModulePath": "../workbookbatch04/quicko.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\quicko\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
