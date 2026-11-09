import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "techjockey",
  "companyName": "Techjockey",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.techjockey.com/company/careers",
  "atsPlatform": "verified-first-party-careers-empty-result",
  "paginationStrategy": "verified-careers-snapshot-empty-result",
  "extractionStrategy": "verified-first-party-careers-surface+zero-public-job-snapshot+return-empty",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.techjockey.com/company/careers was the live Techjockey public careers surface and explicitly stated that there were currently no job openings while directing candidates to career@techjockey.com. This provider returns an authoritative empty result until the verified surface changes.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-empty-result",
  "originalModulePath": "../workbookbatch05/techjockey.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
