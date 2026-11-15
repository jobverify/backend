import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "rexel",
  "companyName": "Rexel",
  "adapter": "script",
  "atsPlatform": "first-party-attrax-server-rendered",
  "countryFilter": "India",
  "paginationStrategy": "bounded-own-india-native-cards-and-full-role-closing",
  "extractionStrategy": "current-corporate-published-native-board+explicit-native-india-option+full-own-role-criteria-and-application-id+closing-reconciliation",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "verificationDisposition": "current-own-native-role-positives-company-scope-unqualified",
  "verifiedSurfaceSummary": "Reconciles current own Rexel India native country options, full role models, original criteria and application IDs across fresh opening and closing reads. Complete company inventory and rendered application remain unqualified; cleanup is forbidden.",
  "originalModulePath": "../workbookbatch11f/failClosedSentinel.js",
  "backfillMode": null,
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
