import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PINE_LABS_CATALOG = {
  source: 'pinelabs',
  companyName: 'Pine Labs',
  officialBrandName: 'Pine Labs',
  adapter: 'script',
  homepageUrl: 'https://www.pinelabs.com/',
  companyCareerPage: 'https://www.pinelabs.com/careers',
  companyDomain: 'pinelabs.com',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-validation',
  extractionStrategy: 'verified-careers-page-without-public-job-board-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.pinelabs.com/careers is the official first-party "Careers at Pine Labs" page and that it exposed a branded careers landing page but no trustworthy public job board or openings feed on that date.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pinelabs/jobs.json',
}

export default PINE_LABS_CATALOG
