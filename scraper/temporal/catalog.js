import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TEMPORAL_CATALOG = {
  source: 'temporal',
  companyName: 'Temporal',
  officialBrandName: 'Temporal',
  adapter: 'script',
  companyCareerPage: 'https://temporal.io/about',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/temporaltechnologies',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/temporaltechnologies/jobs',
  companyDomain: 'temporal.io',
  officialJobBoardDomain: 'job-boards.greenhouse.io',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy:
    'verified-first-party-about-page+official-greenhouse-board+official-greenhouse-board-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary:
    'Verified on September 3, 2026 that https://temporal.io/about remained the live first-party Temporal about page and still handed candidates to https://job-boards.greenhouse.io/temporaltechnologies. The linked Greenhouse board and companion public API at https://boards-api.greenhouse.io/v1/boards/temporaltechnologies/jobs?content=true both now return 404, confirming the previously public board has been retired. This scraper returns no jobs only while the verified first-party handoff remains present and the exact public API continues to return 404.',
  dryRunFile: 'temporal/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TEMPORAL_CATALOG
