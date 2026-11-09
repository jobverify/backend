import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "nomuraindia",
  "companyName": "Nomura India",
  "officialBrandName": "Nomura",
  "adapter": "script",
  "companyCareerPage": "https://careers.nomura.com/Nomura/go/Career-Opportunities-India/9050900/",
  "companyDomain": "nomura.com",
  "atsPlatform": "verified-first-party-careers-empty-result",
  "countryFilter": "India",
  "paginationStrategy": "verified-careers-snapshot-empty-result",
  "extractionStrategy": "verified-first-party-careers-surface+zero-public-job-snapshot+return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://careers.nomura.com/Nomura/go/Career-Opportunities-India/9050900/ was the live first-party careers surface for Nomura India and exposed zero trustworthy public jobs. The dedicated batch-04 snapshot scraper returns this authoritative empty result; a future review must replace it with a parser before publishing jobs.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "verified-empty-state",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-empty-result",
  "originalModulePath": "../workbookbatch04/verifiedCareersEmptyState.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\nomuraindia\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
