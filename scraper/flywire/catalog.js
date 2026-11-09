import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "flywire",
  "companyName": "Flywire",
  "adapter": "script",
  "atsPlatform": "workday-native-guarded",
  "countryFilter": "India",
  "paginationStrategy": "native-first-total-offsets-unique-requisitions-full-reconciliation",
  "extractionStrategy": "corporate-handoff+advertised-CXS-client+all-native-details+typed-India+JobPosting-datePosted",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "backfillMode": "live-parser",
  "zeroResultPolicy": "evidence-required",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "remediationStatus": "native-source-implemented-awaiting-targeted-runtime-review",
  "verificationDisposition": "native-runtime-validation-required",
  "companyCareerPage": "https://www.flywire.com/company/careers",
  "companyDomain": "flywire.com",
  "officialHomepageUrl": "https://www.flywire.com/",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": null,
  "verifiedSurfaceSummary": "Exact official Flywire Workday handoff and advertised anonymous CXS contract. Every run exhausts and reconciles global listing identities, typed native countries, full India descriptions, configured application routes and native JobPosting datePosted. Native legal employer is preserved per role or unknown. Original publication provenance and application access remain unqualified; no static inventory or eligible count claimed."
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
