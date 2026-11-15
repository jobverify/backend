import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "evonik",
  "companyName": "Evonik",
  "adapter": "script",
  "atsPlatform": "workday-native-data",
  "countryFilter": "India",
  "paginationStrategy": "complete-observed-india-page;ten-finite-role-pairs;one-unhydrated-row-held",
  "extractionStrategy": "current-corporate-handoff-and-own-native-api-plus-jobposting-complete-criteria-as-data",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-14",
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "finite-original-native-criteria-data;company-and-executable-scope-unproven",
  "verifiedSurfaceSummary": "Current original corporate careers and literal R47504 seed declare Evonik's own External_Careers account. Eleven typed India rows are observed; ten finite original API and own public JobPosting pairs supply complete criteria data, with both original descriptions retained. Two exact original title vectors differ and remain disclosed. Native primary India/IN and public country agree; additional city strings remain unresolved. Native original posting and expiry dates remain unchanged. The collector requires all48 actual opening/closing observations under90s/15s/4MB and tighter24MB bounds; fixture closure reuse is replay only. Bootstrap programs, token values, CSS, clients, rendered activation, application actions/questions, unhydrated inventory, company scope and lifecycle cleanup remain unqualified.",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "sourceActivationComplete": false,
  "sourceRenderedCriteriaComplete": false,
  "sourceApplicationQualificationComplete": false,
  "originalModulePath": "../workbookbatch10b/failClosedSentinel.js",
  "backfillMode": null,
  "modulePath": path.join(currentDir, 'nativeCriteria20261114.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
