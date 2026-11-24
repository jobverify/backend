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
  "paginationStrategy": "paired-configured-listed-proxy-owned-native-board-and-documented-feed",
  "extractionStrategy": "current-own-jobs-inline-default-unfiltered-consumer-and-every-native-record-primary-secondary-criteria-reconciliation",
  "verifiedOn": "2026-11-21",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "runtimeSourceScopeVerification": true,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "zeroResultPolicy": "paired-current-configured-listed-projection-only-with-every-row-explicit-foreign-country-and-criteria",
  "verifiedSurfaceSummary": "Only the configured current careers-to-jobs handoff, connected default unfiltered inline proxy consumer, owned native board, documented listed feed and every current primary/secondary workplace and criteria may qualify the configured India projection. Company totals, country facets, legal employer, UI/backend activation and cleanup remain unverified. The explicit legacy factory preserves the previous localized-route implementation."
}, modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json') }
export default PROVIDER_METADATA
