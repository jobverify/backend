import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "dotpe",
  "companyName": "DotPe",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-surface-with-non-navigating-open-roles-ctas",
  "companyCareerPage": "https://dotpe.in/careers.html",
  "companyDomain": "dotpe.in",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-first-party-careers-surface+cta-contract+search-form-contract+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://dotpe.in/careers.html was the live exact-company DotPe careers page, that its View Open Roles and See Openings CTAs were both non-navigating # anchors, and that its We're hiring search form exposed only the placeholder Search Jobs, Enter Keyword plus a Search all Jobs submit control with no actionable public search endpoint. No trustworthy enumerable public jobs contract was verified for DotPe, so this company-local scraper stays fail-closed until DotPe exposes a stable first-party or officially handed-off public openings flow.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-surface-with-non-navigating-open-roles-ctas",
  "originalModulePath": "../workbookbatch06/dotpe.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\dotpe.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
