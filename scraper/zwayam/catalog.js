import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zwayam",
  "companyName": "Zwayam",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-public-careers-surface-with-info-edge-parent-handoff",
  "companyCareerPage": "https://www.zwayam.com/career",
  "companyDomain": "zwayam.com",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-public-careers-surface+info-edge-parent-handoff+no-first-party-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.zwayam.com/career was the live first-party public careers surface reviewed for Zwayam. The verified surface presented the headline \"Build the Future of Hiring with Zwayam\" and the handoff copy \"You will be redirected to Info Edge's Careers page (Zwayam's parent company).\" Because the reviewed first-party surface only handed applicants to the parent company careers page and did not verify a trustworthy Zwayam-specific enumerable public jobs contract, this company-local scraper stays fail-closed and returns no jobs until an exact-company public openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-surface-with-info-edge-parent-handoff",
  "originalModulePath": "../workbookbatch06/zwayam.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\zwayam.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
