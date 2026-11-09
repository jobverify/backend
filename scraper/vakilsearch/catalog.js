import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "vakilsearch",
  "companyName": "Vakilsearch",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://vakilsearch.com/careers",
  "atsPlatform": "current-first-party-native-careers",
  "paginationStrategy": "current-corporate-role-cards-and-own-details-with-opening-closing-reconciliation",
  "extractionStrategy": "current-primary-handoff+exact-role-title+complete-native-criteria+exact-current-office-country-corroboration",
  "verifiedOn": null,
  "verifiedSurfaceSummary": "Current corporate careers publishes first-party role cards and full own criteria. Exact Chennai role worksites join the current publisher's Chennai postal address explicitly labeled India. Changed titles, new cities, mixed or remote locations and incomplete criteria remain held; whole-employer scope and cleanup remain unqualified.",
  "countryFilter": "India",
  "zeroResultPolicy": "evidence-required",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "discovery-only",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-jsonld",
  "originalModulePath": "../workbookbatch05/vakilsearch.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
