import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "sumupindia",
  "companyName": "SumUp India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.sumup.com/careers/positions/",
  "atsPlatform": "verified-public-positions-page",
  "paginationStrategy": "single-verified-public-openings-surface",
  "extractionStrategy": "verified-exact-name-public-openings-surface+same-origin-role-links+india-filter",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.sumup.com/careers/positions/ was the live SumUp public positions surface. The location filter and visible listings on Saturday, July 25, 2026 exposed roles in countries such as Germany, Bulgaria, Brazil, Spain, the United Kingdom, and the United States, but no India location. The batch parser extracts same-origin public role links from that verified page and emits only India roles, so the current live result is expected to be empty until India roles appear.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-positions-page",
  "originalModulePath": "../workbookbatch05/sumupindia.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
