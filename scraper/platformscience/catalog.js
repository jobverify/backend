import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PLATFORM_SCIENCE_CATALOG = {
  source: 'platformscience',
  companyName: 'Platform Science',
  adapter: 'script',
  companyCareerPage: 'https://www.platformscience.com/jobs',
  companyDomain: 'platformscience.com',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy: 'verified-first-party-jobs-page+official-greenhouse-board-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.platformscience.com/jobs remained the live first-party Platform Science jobs page and that it publicly exposed India openings including Full Stack Developer - India and Senior Quality Engineer (Automation) - India in Chennai, Tamil Nadu, India. The verified first-party page handed candidates into the official Greenhouse board at https://job-boards.greenhouse.io/platformscience, and the corresponding public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/platformscience/jobs?content=true exposed the same India job surface on the verified date.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PLATFORM_SCIENCE_CATALOG
