import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIX_SENSE_CATALOG = {
  source: '6sense',
  companyName: '6sense',
  adapter: 'script',
  companyCareerPage: 'https://6sense.com/about-us/careers/join-us/',
  companyDomain: '6sense.com',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy: 'verified-first-party-careers-page+official-greenhouse-board-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://6sense.com/about-us/careers/join-us/ remained the first-party 6sense careers page and that it linked candidates to the official public Greenhouse board feed at https://boards-api.greenhouse.io/v1/boards/6sense/jobs?content=true. The verified feed exposed India openings including Principal Architect in Bengaluru, Karnataka, India and Manager, Campaign Operations in Pune, Maharashtra, India on the verified date.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SIX_SENSE_CATALOG
