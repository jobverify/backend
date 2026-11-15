import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "wppplc",
  "companyName": "WPP plc",
  "adapter": "script",
  "atsPlatform": "corporate-delegated-careersitecloud-and-own-greenhouse-application",
  "companyHomepage": "https://www.wpp.com/",
  "companyCareerPage": "https://www.wpp.com/",
  "companyDomain": "wpp.com",
  "countryFilter": "India",
  "paginationStrategy": "bounded-current-published-mixed-agency-leads;own-employer-country-and-role-reconciliation;fresh-closing",
  "extractionStrategy": "exact-own-native-title-plus-independently-typed-city;labelled-employer-country-and-UID;full-schema-visible-and-current-application-criteria",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-own-native-role-positives;company-and-group-scope-unqualified",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "zeroJobsEvidenceRequired": true,
  "verifiedSurfaceSummary": "The configured WPP corporate careers page visibly delegates its current mixed-agency board. Only exact WPP agency roles with independent own typed India country, native UID and exact title/city relationship qualify. Own full visible criteria, the same-employer current application and corporate/native/style closing reads are reconciled. Company/group totals and empty inventory remain unproved; cleanup is forbidden.",
  "originalModulePath": "../workbookbatch11c/failClosedSentinel.js",
  "backfillMode": null,
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
