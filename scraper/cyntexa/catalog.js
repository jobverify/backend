import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CYNTEXA_CATALOG = {
  source: 'cyntexa',
  companyName: 'Cyntexa',
  officialBrandName: 'Cyntexa',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://cyntexa.com/',
  companyCareerPage: 'https://cyntexa.com/careers/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-index-plus-detail-pages',
  extractionStrategy: 'verified-careers-index-plus-first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cyntexa.com',
  dryRunFile: 'cyntexa/jobs.json',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://cyntexa.com/careers/ was the live first-party Cyntexa careers index. The page exposed the Job Opportunities index plus first-party detail pages such as Software Developer, with career contact details on the same host.',
}

export default CYNTEXA_CATALOG
