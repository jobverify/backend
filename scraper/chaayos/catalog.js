import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "chaayos",
  "companyName": "Chaayos",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-exact-name-official-careers-page-with-resume-email-and-no-enumerable-public-jobs-contract",
  "companyCareerPage": "https://chaayos.com/pages/careers",
  "companyDomain": "chaayos.com",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-official-careers-page+resume-email+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://chaayos.com/pages/careers was the live exact-name Chaayos careers surface reviewed for this workbook source, that it presented Chaayos mission and company background copy, and that it directed applicants to share resumes at hr@chaayos.com. The reviewed surface exposed no trustworthy enumerable public jobs contract, no first-party public job inventory, and no handoff to a stable public ATS or exact-company jobs board, so this company-local scraper stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-official-careers-page-with-resume-email-and-no-enumerable-public-jobs-contract",
  "originalModulePath": "../workbookbatch06/chaayos.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\chaayos.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
