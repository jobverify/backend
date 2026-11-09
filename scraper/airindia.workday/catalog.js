import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "airindia",
  "companyName": "Air India",
  "adapter": "script",
  "atsPlatform": "successfactors",
  "companyCareerPage": "https://careers.airindia.com/go/",
  "countryFilter": "India",
  "paginationStrategy": "successfactors-startrow-complete-result-count",
  "extractionStrategy": "official-current-openings-handoff+first-party-successfactors-job-tiles",
  "parser": "air-india-successfactors-html",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-09-13",
  "verifiedPublicJobCount": 20,
  "verifiedIndiaJobCount": 20,
  "verificationDisposition": "live-first-party-complete-inventory-parser",
  "verifiedSurfaceSummary": "Verified on Sunday, September 13, 2026 that https://careers.airindia.com/go/ links SHOW ALL OPENINGS to Air India's first-party SuccessFactors inventory, which exposed 20 current jobs with a complete Showing 1 to 20 of 20 result contract.",
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
