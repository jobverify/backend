import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "cribl",
  "companyName": "Cribl",
  "adapter": "script",
  "companyCareerPage": "https://cribl.io/careers/",
  "companyDomain": "cribl.io",
  "officialHomepageUrl": "https://cribl.io/",
  "atsPlatform": "cribl-native-greenhouse-rsc",
  "parser": "live-parser",
  "countryFilter": "India",
  "paginationStrategy": "complete-native-feed-and-paired-own-RSC-role-models",
  "extractionStrategy": "active-employer-component-binding+reviewed-literal-public-feed+complete-native-own-role-RSC-models+explicit-own-country",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "backfillMode": null,
  "remediationStatus": "native-contract-implemented-country-and-scope-unresolved",
  "verificationDisposition": "native-models-extracted-no-India-zero-or-whole-company-qualification",
  "runtimeValidation": {
    "checkedAt": null,
    "outcome": "registered-original-response-replay-required",
    "sourceScopeComplete": false,
    "lifecycleCleanupAllowed": false
  },
  "bindingEvidence": null,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "requireNativeEmployerName": true,
  "zeroResultPolicy": "evidence-required",
  "verifiedSurfaceSummary": "Current employer component statically declares Cribl public native feed and own role routes. Full models and criteria retained; ambiguous countries, India zero, wider employer scope, applications, persistence and public visibility are unverified."
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
