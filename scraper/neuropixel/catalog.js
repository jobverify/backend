import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "neuropixel",
  "companyName": "NeuroPixel",
  "officialBrandName": "NeuroPixel",
  "adapter": "script",
  "companyCareerPage": "https://www.neuropixel.ai/",
  "companyDomain": "neuropixel.ai",
  "atsPlatform": "verified-exact-name-public-surface-fail-closed-sentinel",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-public-company-surface+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.neuropixel.ai/ was the live NeuroPixel exact-name public company surface and that local repo evidence did not justify a stable enumerable public jobs contract. This provider stays fail-closed until NeuroPixel publishes a trustworthy exact-name openings surface.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-surface-fail-closed-sentinel",
  "originalModulePath": "../workbookbatch04/neuropixel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\neuropixel\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
