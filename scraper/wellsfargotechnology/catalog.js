import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "wellsfargotechnology",
  "companyName": "Wells Fargo Technology",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "workbook-exact-name-sentinel",
  "countryFilter": "India",
  "paginationStrategy": "none",
  "extractionStrategy": "exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-27",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Workbook batch 07 exact-name sentinel for Wells Fargo Technology added on Monday, July 27, 2026. It intentionally returns zero jobs until a trustworthy public careers surface is verified for this exact company name.",
  "backfillMode": "sentinel",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch07/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch07\\wellsfargotechnology.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
