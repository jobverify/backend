import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = { ...{
  "source": "checkoutcom",
  "companyName": "Checkout.com",
  "adapter": "script",
  "catalogOverride": true,
  "companyCareerPage": "https://www.checkout.com/careers",
  "companyDomain": "checkout.com",
  "atsPlatform": "ashby-native-with-corporate-proxy",
  "boardToken": "checkout.com",
  "jobsBoardUrl": "https://jobs.ashbyhq.com/checkout.com",
  "parser": "company-native-script",
  "countryFilter": "India",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "finite-native-api-board-and-corporate-proxy-reconciliation",
  "extractionStrategy": "all-native-role-details-primary-secondary-countries-and-closing-state",
  "verifiedOn": "2026-10-27",
  "sourceScopeComplete": null,
  "lifecycleCleanupAllowed": null,
  "runtimeSourceScopeVerification": true,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "zeroResultPolicy": "coverage-gap",
  "verifiedSurfaceSummary": "Current corporate hiring paths and exact language-menu client-derived locale routes are reconciled with the public Railway proxy, exact employer Ashby board/feed, full role details and closing states. Unanswered routes, native/proxy drift or unknown geography keep source totals unresolved; healthy India candidates remain available."
}, modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json') }
export default PROVIDER_METADATA
