import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "doximity",
  "companyName": "Doximity",
  "adapter": "script",
  "catalogOverride": true,
  "atsPlatform": "greenhouse",
  "parser": "live-parser",
  "boardToken": "doximity",
  "companyCareerPage": "https://work.doximity.com/positions/",
  "companyDomain": "doximity.com",
  "jobsBoardUrl": "https://job-boards.greenhouse.io/doximity",
  "countryFilter": "India",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "complete-native-API-and-unfiltered-published-board-totals;paired-own-hosted-models-and-visible-criteria",
  "extractionStrategy": "current-employer-native-embed;all-complete-native-API-and-hosted-Remix-models;own-visible-role-criteria;explicit-native-country-and-publication-evidence",
  "backfillMode": null,
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "zeroResultPolicy": "evidence-required",
  "requireNativeEmployerName": true,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "remediationStatus": "complete-native-API-and-hosted-publication-implemented;worksite-country-and-company-scope-held",
  "verificationDisposition": "all-native-models-and-current-public-criteria-before-country-selection;no-unverified-company-or-India-zero",
  "verifiedSurfaceSummary": "Complete native API fields, office/country evidence and original descriptions are preserved alongside full own published models and exact visible criteria. Current post publication is checked separately from active hiring, applications, whole-company scope, persistence and public visibility. Unknown worksite countries and native fields remain unresolved; source/lifecycle completion stays false.",
  "runtimeValidation": {
    "checkedAt": null,
    "outcome": "current-registered-native-publication-verification-required;unqualified-company-and-India-scope",
    "sourceScopeComplete": false,
    "lifecycleCleanupAllowed": false
  }
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
