import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "brij",
  "companyName": "Brij",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://brij.ai/careers",
  "companyDomain": "brij.ai",
  "officialJobsBoardUrl": "https://brij.applytojob.com/apply",
  "atsPlatform": "official-careers-page-plus-applytojob-board",
  "countryFilter": "India",
  "paginationStrategy": "validate-official-careers-page-then-read-linked-public-applytojob-board",
  "extractionStrategy": "official-careers-page-handoff-verification+public-jazzhr-board+detail-enrichment+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 1,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://brij.ai/careers was the live first-party Brij careers surface, that it handed applicants to the public JazzHR board at https://brij.applytojob.com/apply, and that the board's current live opening was Director of Partnerships in New York City, NY. This scraper validates the first-party handoff plus the hosted board detail surface and returns only India openings, so it currently emits zero India jobs.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-careers-page-plus-applytojob-board",
  "originalModulePath": "../workbookbatch02/brij.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\brij.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
