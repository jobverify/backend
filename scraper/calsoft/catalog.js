import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CALSOFT_CATALOG = {
  source: 'calsoft',
  companyName: 'Calsoft',
  officialBrandName: 'Calsoft',
  adapter: 'script',
  homepageUrl: 'https://www.calsoftinc.com/',
  companyCareerPage: 'https://www.calsoftinc.com/career',
  atsPlatform: 'official-company-careers-zero-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+zero-public-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'calsoftinc.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.calsoftinc.com/career remained the exact first-party Calsoft careers page and rendered Evolve with Calsoft, Open vacancies, 0 Results, and No jobs found, so this provider stays fail-closed with an empty result set until trustworthy public openings appear on that exact-name surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CALSOFT_CATALOG
