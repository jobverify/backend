import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "suprdaily",
  "companyName": "Supr Daily",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.suprdaily.com/",
  "atsPlatform": "verified-company-domain-redirect-drift-sentinel",
  "paginationStrategy": "single-public-company-surface",
  "extractionStrategy": "verified-company-domain-offdomain-redirect+no-public-listings-sentinel",
  "verifiedOn": "2026-08-04",
  "verifiedSurfaceSummary": "Verified on Tuesday, August 4, 2026 that https://www.suprdaily.com/ no longer resolved to a trustworthy first-party Supr Daily surface and instead redirected off-domain to https://www.keluarantotomacau.it.com/, where no trustworthy public jobs inventory or ATS handoff was exposed. This provider stays fail-closed and throws if a real public jobs surface returns.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface",
  "originalModulePath": "../workbookbatch05/suprdaily.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
