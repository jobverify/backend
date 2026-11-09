import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "thirdeyedata",
  "companyName": "ThirdEyeData",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://thirdeyedata.ai/current-openings",
  "atsPlatform": "verified-public-jobpost-detail-pages",
  "paginationStrategy": "single-verified-current-openings-surface+same-origin-jobpost-detail-pages",
  "extractionStrategy": "verified-exact-name-public-openings-surface+same-origin-jobpost-detail-pages+india-filter+same-page-apply-contract",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://thirdeyedata.ai/careers/ was the live ThirdEye Data careers landing page and that its public openings archive was available at https://thirdeyedata.ai/current-openings. The batch parser keeps only same-origin /jobpost/ detail pages from that verified openings surface, emits only India roles, and requires the detail page's inline Apply Online contract to remain intact.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-jobpost-detail-pages",
  "originalModulePath": "../workbookbatch05/thirdeyedata.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
