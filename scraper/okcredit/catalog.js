import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OK_CREDIT_CATALOG = {
  source: 'okcredit',
  companyName: 'OkCredit',
  officialBrandName: 'OkCredit',
  adapter: 'script',
  homepageUrl: 'https://okcredit.in/',
  companyCareerPage: 'https://okcredit.in/careers',
  companyDomain: 'okcredit.in',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-page-no-open-jobs-validation',
  extractionStrategy: 'verified-homepage+verified-careers-page-no-current-openings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://okcredit.in/ is the live official OkCredit homepage and https://okcredit.in/careers is the official first-party careers page. The careers page explicitly states "We are not hiring at the moment" and "No Current Job Openings" with a peopleops@okcredit.in contact, and it did not expose trustworthy public job listings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'okcredit/jobs.json',
}

export default OK_CREDIT_CATALOG
