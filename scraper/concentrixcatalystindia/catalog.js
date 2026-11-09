import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "concentrixcatalystindia",
  "companyName": "Concentrix Catalyst India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-exact-name-linkedin-company-surface-plus-parent-careers-handoff-without-trustworthy-exact-company-jobs-contract",
  "companyCareerPage": "https://in.linkedin.com/company/concentrix-catalyst",
  "companyDomain": "linkedin.com",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-linkedin-company-surface+parent-careers-handoff+no-exact-company-jobs-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-09-03",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on September 3, 2026 that https://in.linkedin.com/company/concentrix-catalyst remained the live exact-name public company surface reviewed for workbook company Concentrix Catalyst India, that it pointed to https://catalyst.concentrix.com/ and exposed India locations including Bangalore, Chennai, and Hyderabad, and that the broader official India surface at https://www.concentrix.com/india/ handed applicants to the general Concentrix careers site at jobs.concentrix.com. The reviewed public LinkedIn jobs search at https://in.linkedin.com/jobs/concentrix-catalyst-jobs now advertises 1,000+ India roles, but its visible result data is attributed to the parent Concentrix brand rather than the exact workbook company. Because the reviewed public surfaces did not establish a trustworthy exact-company Concentrix Catalyst India enumerable jobs contract, this company-local scraper stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-linkedin-company-surface-plus-parent-careers-handoff-without-trustworthy-exact-company-jobs-contract",
  "originalModulePath": "../workbookbatch06/concentrixcatalystindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\concentrixcatalystindia.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
