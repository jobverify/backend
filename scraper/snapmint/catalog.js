import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "snapmint",
  "companyName": "Snapmint",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://careers.snapmint.com/snapmint/",
  "atsPlatform": "verified-public-careers-jsonld",
  "paginationStrategy": "single-verified-public-openings-surface",
  "extractionStrategy": "verified-exact-name-public-openings-surface+same-origin-jobposting-jsonld+india-filter",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://snapmint.com/about-us was the live first-party Snapmint company surface and that Snapmint's public openings hub was available at https://careers.snapmint.com/snapmint/. The batch parser only emits India JobPosting JSON-LD with a same-origin public application URL; it returns no jobs when that narrow contract is absent.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-jsonld",
  "originalModulePath": "../workbookbatch05/snapmint.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
