import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "dovercorporation",
  "companyName": "Dover Corporation",
  "adapter": "script",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "current-native-India-office-facets-all-pages-with-closing-reconciliation",
  "extractionStrategy": "first-party-careers-host-redirect+native-country-legal-employer-date-full-role-and-closing-reconciliation",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "official-native-India-office-subset-company-scope-partial",
  "verifiedSurfaceSummary": "Requires the current exact first-party careers-host redirect to Dover's Workday board at opening and closing. Reconciles current typed India office facets, selected native pages and complete active role models. Whole-company inventory and India totals remain unknown; lifecycle cleanup is disabled.",
  "sourceScopeComplete": false,
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
