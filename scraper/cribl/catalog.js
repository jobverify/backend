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
  "parser": "custom-script",
  "countryFilter": "India",
  "paginationStrategy": "paired-own-careers-and-complete-original-registered-board-lead-observations;no-company-inventory-claim",
  "extractionStrategy": "bounded-original-Responses+current-own-native-opening-owner+registered-board-model-retention;unknown-workplaces-and-current-client-role-application-held",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "backfillMode": "live-parser",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 120000,
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
  "verifiedSurfaceSummary": "Current own careers/native opening-owner and complete original registered-board models are retained in paired observations. The registered API is a lead; current client dataflow, own role/application binding and city-only workplace countries remain unqualified. Office names and Corporation addresses never supply workplace countries; no configured India-zero or company inventory claim is made."
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
