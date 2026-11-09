import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const BASE64AI_CATALOG={
  "source": "base64ai",
  "companyName": "Base64.ai",
  "adapter": "script",
  "atsPlatform": "first-party-native-html-disclosures",
  "countryFilter": "India",
  "paginationStrategy": "entire-own-native-careers-region-and-exact-primary-closing",
  "extractionStrategy": "all-complete-native-role-content-and-own-metadata-before-selection-caps-observers-failure",
  "parser": "live-parser",
  "normalizationProfile": "engineering-default",
  "catalogOverride": true,
  "companyCareerPage": "https://base64.ai/careers/",
  "officialHomepageUrl": "https://base64.ai/",
  "companyDomain": "base64.ai",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "backfillMode": null,
  "runtimeValidation": null,
  "bindingEvidence": null,
  "originalAdapter": null,
  "originalAtsPlatform": null,
  "originalModulePath": null,
  "originalDryRunFile": null,
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "listingComplete": false,
  "lifecycleCleanupAllowed": false,
  "zeroResultPolicy": "evidence-required",
  "requireNativeEmployerName": true,
  "verificationDisposition": "native-four-role-extraction;company-scope-and-render-hiring-unqualified",
  "remediationStatus": "native-posting-extraction;company-scope-unresolved",
  "verifiedSurfaceSummary": "Retain full own native role disclosures, exact authored content HTML and independent Type/Location/application subject before selection,caps,observers or failure. Missing native IDs/dates stay null; adapter keys are explicitly synthetic. Reconcile full native careers records and own routing at close. Remote is not India. Whole-company totals,authoritative India zero,rendered criteria,current hiring/application and lifecycle cleanup remain unqualified."
}
BASE64AI_CATALOG.modulePath=path.join(currentDir,'script.js')
BASE64AI_CATALOG.dryRunFile=path.join(currentDir,'jobs.json')
export const PROVIDER_METADATA=BASE64AI_CATALOG
export default BASE64AI_CATALOG
