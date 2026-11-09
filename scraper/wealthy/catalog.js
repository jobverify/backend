import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "wealthy",
  "companyName": "Wealthy",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.wealthy.in/careers",
  "atsPlatform": "zoho-recruit-public-board",
  "paginationStrategy": "single-first-party-handoff+zoho-recruit-hidden-input-board",
  "extractionStrategy": "verified-first-party-careers-page+official-zoho-recruit-hidden-input-board+detail-url-reconstruction+empty-board-rss-fallback",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.wealthy.in/careers was the live Wealthy careers surface and that its View all jobs handoff pointed to the official Zoho Recruit board at https://wealthy.zohorecruit.in/jobs/Careers. The batch parser extracts roles from the board's hidden-input JSON payloads, reconstructs public detail URLs when needed, and accepts the paired RSS removal signal as the authoritative empty-board contract.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "zoho-recruit-public-board",
  "originalModulePath": "../workbookbatch05/wealthy.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
