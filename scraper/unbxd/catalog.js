import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "unbxd",
  "companyName": "Unbxd",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://try.unbxd.com/",
  "atsPlatform": "verified-exact-name-brand-surfaces-fail-closed",
  "paginationStrategy": "multi-page-verified-brand-surfaces",
  "extractionStrategy": "verified-exact-name-brand-surfaces+no-public-listings-sentinel",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that Unbxd's live exact-name public brand surfaces remained visible at https://try.unbxd.com/ and https://netcoreunbxd.com/about/. This provider remains fail-closed unless those verified brand surfaces drift or begin exposing a trustworthy public jobs surface.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-brand-surfaces-fail-closed",
  "originalModulePath": "../workbookbatch05/unbxd.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
