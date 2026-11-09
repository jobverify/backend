import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "fablestreet",
  "companyName": "Fablestreet",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-exact-name-official-public-surface-with-jobs-email-and-no-enumerable-public-jobs-contract",
  "companyCareerPage": "https://www.fablestreet.com/pages/about-us",
  "companyDomain": "fablestreet.com",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-official-public-surface+jobs-email+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.fablestreet.com/pages/about-us was the live exact-name FableStreet official public surface reviewed for workbook company Fablestreet, that it exposed brand/about copy plus the direct jobs contact channel careers@fablestreet.com, and that the reviewed surface exposed no trustworthy enumerable public jobs contract, no first-party public job inventory, and no handoff to a stable public ATS or exact-company jobs board. This company-local scraper therefore stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-official-public-surface-with-jobs-email-and-no-enumerable-public-jobs-contract",
  "originalModulePath": "../workbookbatch06/fablestreet.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\fablestreet.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
