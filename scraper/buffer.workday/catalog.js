import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "buffer",
  "companyName": "Buffer",
  "adapter": "script",
  "atsPlatform": "official-company-careers",
  "companyDomain": "buffer.com",
  "companyCareerPage": "https://buffer.com/journey",
  "countryFilter": "India",
  "paginationStrategy": "native-opening-and-independent-closing",
  "extractionStrategy": "strict-native-empty-scope-and-bound-client-list-positive-schema-unsupported",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "zeroResultPolicy": "evidence-required",
  "verificationDisposition": "runtime-native-explicit-empty-only-positive-schema-unreviewed",
  "verifiedSurfaceSummary": "The selected native collector supports only the exact currently observed empty role-list contract. Whole-company zero requires visible scope, a bound literal empty client list and independently timed matching closing evidence; unknown, stale or unsupported positive schemas fail closed.",
  "originalModulePath": "../workbookbatch10e/failClosedSentinel.js",
  "backfillMode": "native-empty-inventory-only",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
