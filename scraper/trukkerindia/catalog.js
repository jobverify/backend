import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "trukkerindia",
  "companyName": "TruKKer India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.trukker.com/careers",
  "atsPlatform": "current-first-party-declared-json-careers",
  "paginationStrategy": "full-declared-native-feed-and-own-role-opening-closing-reconciliation",
  "extractionStrategy": "current-careers-handoff+reviewed-static-client+typed-native-country+full-native-criteria+email-handoff",
  "verifiedOn": null,
  "verifiedSurfaceSummary": "The current careers page declares a native JSON vacancy feed and public own role pages. Typed India records with consistent physical worksites, full authored criteria and the native application handoff qualify partial observations. Unknown countries, company-wide inventory and lifecycle cleanup remain unqualified.",
  "countryFilter": "India",
  "zeroResultPolicy": "evidence-required",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "discovery-only",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-jsonld",
  "originalModulePath": "../workbookbatch05/trukkerindia.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
