import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BETSOL_CATALOG = {
  source: 'betsol',
  companyName: 'Betsol',
  officialBrandName: 'BETSOL',
  adapter: 'script',
  homepageUrl: 'https://www.betsol.com/',
  companyCareerPage: 'https://www.betsol.com/careers/',
  boardUrl: 'https://careers.smartrecruiters.com/Betsol',
  companyDomain: 'betsol.com',
  atsPlatform: 'smartrecruiters-public-postings-api',
  countryFilter: 'India',
  paginationStrategy: 'complete-smartrecruiters-public-postings-api-with-board-count-check',
  extractionStrategy:
    'verified-first-party-careers-linkout+exact-name-smartrecruiters-board+public-posting-details+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the first-party BETSOL careers page at https://www.betsol.com/careers/ links to the exact-name SmartRecruiters board at https://careers.smartrecruiters.com/Betsol. The board shows 19 current openings, matching the documented public Posting API at https://api.smartrecruiters.com/v1/companies/Betsol/postings. Sixteen published postings are explicitly in India, across Bengaluru and Pune. The scraper checks the complete board count, API inventory, and active posting details.',
  dryRunFile: 'betsol/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BETSOL_CATALOG
