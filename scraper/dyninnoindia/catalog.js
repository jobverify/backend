import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DYNINNO_INDIA_CATALOG = {
  source: 'dyninnoindia',
  companyName: 'Dyninno India',
  officialBrandName: 'Dyninno',
  adapter: 'script',
  companyCareerPage: 'https://dyninno.com/en/offices/india/',
  atsPlatform: 'first-party-office-jobs-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-office-page',
  extractionStrategy: 'verified-first-party-india-office-page+inline-job-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dyninno.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://dyninno.com/en/offices/india/ was the live first-party Dyninno India office page and that it publicly listed India opportunities including Remote Freelance Travel Consultant | Dreamport and TRAVEL SALES CONSULTANT under the Trevolution business on the same exact-name office surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default DYNINNO_INDIA_CATALOG
