import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "smarterai",
  "companyName": "SmarterAI",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://smarterai.com/careers/open-positions",
  "atsPlatform": "verified-public-open-positions-detail-pages",
  "paginationStrategy": "single-verified-open-positions-surface+same-origin-detail-pages",
  "extractionStrategy": "verified-exact-name-open-positions-surface+same-origin-role-detail-pages+india-filter+verified-external-apply-link",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://smarterai.com/careers was the live Smarter AI careers landing page and that its public openings hub was available at https://smarterai.com/careers/open-positions. The batch parser walks same-origin /careers/<role> detail pages, accepts a public external Apply link only when it is linked from a verified Smarter AI detail page, and emits only India roles. Because the visible public openings on Saturday, July 25, 2026 were Atlanta and Dubai roles, the current live result is expected to be empty until an India role appears.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-open-positions-detail-pages",
  "originalModulePath": "../workbookbatch05/smarterai.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
