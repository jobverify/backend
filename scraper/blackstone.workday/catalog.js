import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "blackstone",
  "companyName": "Blackstone",
  "adapter": "script",
  "atsPlatform": "workbook-exact-name-sentinel",
  "countryFilter": "India",
  "paginationStrategy": "none",
  "extractionStrategy": "exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-08",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedSurfaceSummary": "Workbook batch 10 exact-name sentinel for Blackstone added on Saturday, August 8, 2026. It intentionally returns zero jobs until a trustworthy public careers surface is verified for this exact company name.",
  "originalModulePath": "../workbookbatch10f/failClosedSentinel.js",
  "backfillMode": "workday",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
