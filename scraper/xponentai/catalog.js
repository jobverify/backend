import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "xponentai",
  "companyName": "xponent.ai",
  "adapter": "script",
  "companyCareerPage": "https://xponent.ai/career/",
  "companyDomain": "xponent.ai",
  "officialHomepageUrl": "https://xponent.ai/",
  "atsPlatform": "wp-job-openings-native-own-html",
  "parser": "live-parser",
  "countryFilter": "India",
  "paginationStrategy": "native-REST-total-and-next-links;paired-complete-own-JSON-and-own-HTML",
  "extractionStrategy": "current-careers-native-plugin-and-REST-declaration;complete-published-post-models;full-own-visible-criteria;explicit-native-country",
  "normalizationProfile": "engineering-default",
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
  "remediationStatus": "native-own-page-criteria-implemented;country-and-company-scope-unresolved",
  "verificationDisposition": "native-posts-and-complete-criteria-before-country-selection;no-unverified-India-zero",
  "verifiedSurfaceSummary": "Complete native published WP post models and own-page descriptions retained. Empty API content does not discard own visible criteria. Native country, actual hiring, company scope, applications, persistence and public visibility remain subject to separate evidence; no onsite or city-to-India default.",
  "runtimeValidation": {
    "checkedAt": null,
    "outcome": "current-original-native-replay-required;unqualified-company-and-India-scope",
    "sourceScopeComplete": false,
    "lifecycleCleanupAllowed": false
  }
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
