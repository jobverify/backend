import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.dirname(fileURLToPath(import.meta.url))
export const VANTA_CATALOG = { ...{
  "source": "vanta",
  "companyName": "Vanta",
  "adapter": "script",
  "catalogOverride": true,
  "companyCareerPage": "https://www.vanta.com/company/careers",
  "companyDomain": "vanta.com",
  "atsPlatform": "ashby-native-current-corporate-client",
  "boardToken": "vanta",
  "jobsBoardUrl": "https://jobs.ashbyhq.com/vanta",
  "parser": "company-native-script",
  "countryFilter": "India",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "finite-native-api-and-board-reconciliation",
  "extractionStrategy": "all-native-role-details-primary-secondary-countries-and-closing-state",
  "verifiedOn": "2026-10-27",
  "sourceScopeComplete": null,
  "lifecycleCleanupAllowed": null,
  "runtimeSourceScopeVerification": true,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "zeroResultPolicy": "coverage-gap",
  "verifiedSurfaceSummary": "Current corporate inline Ashby client replaces legacy Webflow cards. Exact employer board/feed/full role details and closing states are reconciled. Countries use native structured evidence, or the two validated role-owned city plus postal-state labels with explicit official USPS inference provenance. Unknown future labels and conflicting countries remain unresolved."
}, modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json') }
export default VANTA_CATALOG
