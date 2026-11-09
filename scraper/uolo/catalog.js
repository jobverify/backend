import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "uolo",
  "companyName": "Uolo",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.uolo.com/",
  "atsPlatform": "verified-exact-name-public-company-surface-with-linkedin-handoff",
  "paginationStrategy": "single-public-company-surface",
  "extractionStrategy": "verified-exact-name-public-company-surface+linkedin-handoff-without-first-party-openings+fail-closed",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.uolo.com/ was the live Uolo exact-name public company surface and that its Careers footer handed off to LinkedIn at https://www.linkedin.com/company/uolo/jobs/ instead of exposing a stable first-party jobs inventory. This provider stays fail-closed until a stable exact-name public jobs surface is promoted.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-exact-name-public-company-surface-with-linkedin-handoff",
  "originalModulePath": "../workbookbatch05/uolo.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
