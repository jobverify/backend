import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DATAIKU_CATALOG = {
  source: 'dataiku',
  companyName: 'Dataiku',
  adapter: 'script',
  companyCareerPage: 'https://www.dataiku.com/company/careers',
  companyDomain: 'dataiku.com',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed-current-empty-india-slice',
  extractionStrategy:
    'verified-first-party-careers-page+official-greenhouse-board+official-greenhouse-board-api+india-filter+empty-india-slice-contract',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.dataiku.com/company/careers was the live first-party Dataiku careers page, that its Explore all open positions and See open opportunities calls-to-action handed applicants to the official Greenhouse board at https://job-boards.greenhouse.io/dataiku, and that the companion public Greenhouse API feed at https://boards-api.greenhouse.io/v1/boards/dataiku/jobs?content=true was live. The verified board exposed 24 jobs on the verified date, including Senior Manager, People Systems in the United States, Enterprise Account Executive in Seoul, Technical Partner Enablement Manager in Singapore, and Software Engineer in Test - Onsite or Remote (FR, UK, DE, NL) in EMEA, with zero India openings.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DATAIKU_CATALOG
