import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "vervotech",
  "companyName": "Vervotech",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://vervotech.com/about-us/",
  "atsPlatform": "verified-exact-name-public-company-surface",
  "paginationStrategy": "single-public-company-surface",
  "extractionStrategy": "verified-exact-name-public-company-surface+no-public-listings-sentinel",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://vervotech.com/about-us/ was the live Vervotech exact-name public company surface and that it exposed no trustworthy public careers or jobs inventory. This provider stays fail-closed until Vervotech publishes a stable exact-name public openings surface.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface",
  "originalModulePath": "../workbookbatch05/vervotech.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
