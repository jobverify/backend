import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "anomaloindia",
  "companyName": "Anomalo India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "workbook-exact-name-sentinel",
  "countryFilter": "India",
  "paginationStrategy": "none",
  "extractionStrategy": "exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedSurfaceSummary": "Workbook batch 02 exact-name sentinel for Anomalo India added on Saturday, July 25, 2026. It intentionally returns zero jobs until a trustworthy public careers surface is verified for this exact company name.",
  "backfillMode": "sentinel",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch02/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\anomaloindia.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
