import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "stackbox",
  "companyName": "Stackbox",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.stackbox.xyz/company",
  "atsPlatform": "verified-homepage-with-broken-company-route-sentinel",
  "paginationStrategy": "verified-homepage-plus-broken-company-route-return-empty",
  "extractionStrategy": "verified-homepage+verified-branded-broken-company-route+return-empty",
  "verifiedOn": "2026-08-01",
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://www.stackbox.xyz/ was the live Stackbox homepage, and that the legacy /company route resolved to a branded 404 page at https://www.stackbox.xyz/untitled/about-us with canonical https://www.stackbox.xyz/404 rather than exposing a public careers or jobs inventory.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface",
  "originalModulePath": "../workbookbatch05/stackbox.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
