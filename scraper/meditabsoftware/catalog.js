import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MEDITAB_SOFTWARE_CATALOG = {
  source: 'meditabsoftware',
  companyName: 'Meditab Software',
  officialBrandName: 'Meditab',
  adapter: 'script',
  homepageUrl: 'https://www.meditab.com/',
  companyCareerPage: 'https://www.meditab.com/company/our-careers',
  atsPlatform: 'official-company-site-no-public-job-records',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-without-public-job-records',
  extractionStrategy: 'verified-first-party-careers-page+returns-empty-array',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'meditab.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.meditab.com/company/our-careers was the live first-party Meditab careers page, that it exposed the Find your Next Career messaging plus the recruitment@meditab.com resume intake path for Careers India, and that the page still contained no public job records or first-party batch-safe listing surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'meditabsoftware/jobs.json',
}

export default MEDITAB_SOFTWARE_CATALOG
