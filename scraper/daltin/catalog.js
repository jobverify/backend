import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "daltin",
  "companyName": "Daltin",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-official-careers-page-with-no-trustworthy-enumerable-public-jobs-contract",
  "companyCareerPage": "https://daltinedugroup.com/careers/",
  "companyDomain": "daltinedugroup.com",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-official-careers-page+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://daltinedugroup.com/careers/ was the live official Daltin Edu Group careers surface reviewed for workbook source Daltin. The reviewed page exposed company values, benefits and contact-driven hiring copy including \"Who we are.\", \"Benefits & Perks\", \"Our ride so far.\", and \"Looking to participate in Global Education revolution? Connect with us!\", but no trustworthy enumerable public jobs contract, no first-party public job inventory, and no handoff to a stable public ATS or exact-company jobs board. This company-local scraper therefore stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-official-careers-page-with-no-trustworthy-enumerable-public-jobs-contract",
  "originalModulePath": "../workbookbatch06/daltin.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\daltin.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
