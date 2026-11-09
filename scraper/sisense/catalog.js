import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SISENSE_CATALOG = {
  source: 'sisense',
  companyName: 'Sisense',
  adapter: 'script',
  companyCareerPage: 'https://www.sisense.com/about/careers/',
  companyDomain: 'sisense.com',
  atsPlatform: 'ashby-job-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-ashby-job-board-feed',
  extractionStrategy:
    'verified-first-party-careers-page+official-ashby-board+official-ashby-job-board-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-12',
  verifiedSurfaceSummary:
    'Verified on September 12, 2026 that https://www.sisense.com/about/careers/ remains the first-party Sisense careers page and its current public roles use the Ashby board at https://jobs.ashbyhq.com/sisense. The legacy Greenhouse board now returns HTTP 404, while current publicly indexed Sisense role URLs resolve under the official Ashby board. The corresponding public Ashby feed is https://api.ashbyhq.com/posting-api/job-board/sisense; the scraper keeps the India-only filter and returns an honest empty set when no India roles are listed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SISENSE_CATALOG
