import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "synup",
  "companyName": "Synup",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://synup.com/careers",
  "atsPlatform": "first-party-careers-page-linkedin-handoff",
  "paginationStrategy": "fresh-official-careers+delegated-company+employer-filtered-india-search+guest-first-page-discovery",
  "extractionStrategy": "current-official-active-handoff+exact-linkedin-organization-and-backlink+scoped-search-no-match+coverage-gap",
  "verifiedOn": "2026-10-23",
  "verifiedSurfaceSummary": "Verified October 23, 2026: legacy /en/careers redirects to https://synup.com/careers. Two active SEE OPEN POSITIONS CTAs link to LinkedIn /company/synup/jobs/. Public company profile confirms Synup, organization 9322483 and synup.com backlink. Employer-filtered India search reports no matches and the corresponding guest page contains only its empty HTML skeleton. This scoped observation does not establish whole-company inventory, current country totals or continued activity of historical social-post jobs. The adapter performs fresh bounded discovery and raises an explicit coverage gap, preserving prior jobs; it never reports verified empty inventory.",
  "listingComplete": false,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "reportedTotal": null,
  "indiaFacetCount": null,
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "first-party-careers-page-linkedin-handoff",
  "originalModulePath": "../workbookbatch05/synup.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
