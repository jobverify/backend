import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const ATTACKIQ_CATALOG={
  "source": "attackiq",
  "companyName": "AttackIQ",
  "adapter": "script",
  "atsPlatform": "first-party-and-jazz-literal-widget-native-html",
  "countryFilter": "India",
  "paginationStrategy": "all-observed-declared-native-postings-and-closing-helper-board-primary",
  "extractionStrategy": "exact-company-handoff+static-AST-Jazz-widget+own-posting-full-models-and-authored-criteria",
  "parser": "live-parser",
  "normalizationProfile": "engineering-default",
  "catalogOverride": true,
  "companyCareerPage": "https://www.attackiq.com/who-we-are/careers/",
  "officialHomepageUrl": "https://www.attackiq.com/",
  "companyDomain": "attackiq.com",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "backfillMode": null,
  "runtimeValidation": null,
  "verifiedAt": null,
  "bindingEvidence": null,
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "lifecycleCleanupAllowed": false,
  "zeroResultPolicy": "evidence-required",
  "verificationDisposition": "native-posting-extraction;own-country-and-company-inventory-unresolved",
  "remediationStatus": "native-posting-extraction;own-country-unresolved",
  "verifiedSurfaceSummary": "Current company careers/openings declare one Jazz literal widget with one observed own posting. Preserve all five actual HTML insertions,complete metadata and all5240 authored criteria characters before selection,limits,observers or failures. Own location Remote and title USA do not establish country;country/requisition/dates/city/state remain unknown. No accepted inventory,India-zero,rendered visibility,hiring/apply or lifecycle authority."
}
ATTACKIQ_CATALOG.modulePath=path.join(currentDir,'script.js')
ATTACKIQ_CATALOG.dryRunFile=path.join(currentDir,'jobs.json')
export const PROVIDER_METADATA=ATTACKIQ_CATALOG
export default ATTACKIQ_CATALOG
