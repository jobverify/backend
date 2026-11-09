import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "spheraindia",
  "companyName": "Sphera India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://sphera.com/company/join-our-team/",
  "atsPlatform": "verified-first-party-workday-handoff",
  "paginationStrategy": "shared-workday-jobs-api+country-filter",
  "extractionStrategy": "verified-first-party-careers-page+exact-workday-handoff+shared-workday-engine+india-country-filter",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://sphera.com/company/join-our-team/ was the live Sphera careers surface and that its exact \"See all jobs\" handoff pointed to the public Workday board at https://sphera.wd1.myworkdayjobs.com/careers. The batch parser reuses the shared Workday engine, requires the verified first-party headline and category-link contract, and emits only India roles from that public board.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-workday-handoff",
  "originalModulePath": "../workbookbatch05/spheraindia.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
