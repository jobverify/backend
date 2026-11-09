import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "telioev",
  "companyName": "TelioEV",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://telioev.com/",
  "atsPlatform": "verified-exact-name-public-surface-fail-closed",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-exact-name-public-surface+company-specific-fail-closed-wrapper",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://telioev.com/ was the live TelioEV exact-name public company surface. Local repo evidence did not justify a stable enumerable public jobs contract, so this provider remains a company-specific fail-closed wrapper until a trustworthy openings surface is verified.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-surface-fail-closed",
  "originalModulePath": "../workbookbatch05/telioev.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
