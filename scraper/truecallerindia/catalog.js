import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "truecallerindia",
  "companyName": "Truecaller India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.truecaller.com/careers",
  "atsPlatform": "current-employer-declared-greenhouse",
  "paginationStrategy": "full-native-list-and-own-india-details-with-opening-closing-reconciliation",
  "extractionStrategy": "current-corporate-jobs-link+reviewed-static-client+original-native-india-offices-and-full-criteria",
  "verifiedOn": null,
  "verifiedSurfaceSummary": "Current corporate careers routes declare the public Greenhouse account. Explicit role-assigned India office countries and paired full own native criteria qualify positive observations. Whole-employer inventory, unknown countries and lifecycle cleanup remain unqualified.",
  "countryFilter": "India",
  "zeroResultPolicy": "evidence-required",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "discovery-only",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-jsonld",
  "originalModulePath": "../workbookbatch05/truecallerindia.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
