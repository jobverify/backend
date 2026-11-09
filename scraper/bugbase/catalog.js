import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "bugbase",
  "companyName": "Bugbase",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-exact-name-official-public-surface-with-no-trustworthy-jobs-contract",
  "companyCareerPage": "https://bugbase.ai/companies",
  "companyDomain": "bugbase.ai",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-official-public-surface+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://bugbase.ai/companies was the live official BugBase public company surface reviewed for this workbook source. The reviewed page promoted BugBase offerings for corporations, including vulnerability disclosure, managed bug bounty, private bug bounty, CTF hosting and hiring challenges, and enterprise pentesting, but no trustworthy exact-company careers page, no first-party handoff to a stable public ATS or company jobs board, and no trustworthy enumerable public jobs contract were verified. This company-local scraper therefore stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-official-public-surface-with-no-trustworthy-jobs-contract",
  "originalModulePath": "../workbookbatch06/bugbase.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\bugbase.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
