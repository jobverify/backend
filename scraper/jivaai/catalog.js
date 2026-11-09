import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "jivaai",
  "companyName": "Jiva AI",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "workbook-exact-name-sentinel",
  "countryFilter": "India",
  "paginationStrategy": "none",
  "extractionStrategy": "exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Workbook batch 03 exact-name sentinel for Jiva AI added on Saturday, July 25, 2026. No trustworthy public careers surface has yet been verified for the exact Jiva AI company name, so this provider intentionally returns zero jobs until that changes.",
  "backfillMode": "sentinel",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch03/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch03\\jivaai.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
