import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "sukoon",
  "companyName": "Sukoon",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://trysukoon.com/",
  "atsPlatform": "verified-exact-name-company-surface-no-public-listings",
  "paginationStrategy": "single-public-company-surface",
  "extractionStrategy": "verified-exact-name-company-surface+services-marketplace-signals+no-public-listings-sentinel",
  "verifiedOn": "2026-08-04",
  "verifiedSurfaceSummary": "Verified on Tuesday, August 4, 2026 that https://trysukoon.com/ was the exact-name public Sukoon services surface for online counselling, life coaching, and Ruqyah sessions, and that no stable enumerable first-party jobs inventory was publicly verified. This provider stays fail-closed and throws if first-party listings or JobPosting markup appear.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-company-surface-with-hiring-signals",
  "originalModulePath": "../workbookbatch05/sukoon.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
