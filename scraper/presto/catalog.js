import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRESTO_CATALOG = {
  source: 'presto',
  companyName: 'Presto',
  officialBrandName: 'Presto',
  adapter: 'script',
  homepageUrl: 'https://www.presto-apps.com/',
  companyCareerPage: 'https://www.presto-apps.com/careers',
  officialJobsScriptUrl: 'https://www.presto-apps.com/assets/js/js-p2023.js',
  companyDomain: 'presto-apps.com',
  atsPlatform: 'official-company-site-inline-js-job-array',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-inline-javascript-array',
  extractionStrategy:
    'verified-first-party-careers-page+verified-inline-jobpostings-array+linkedin-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.presto-apps.com/careers is the live first-party Presto careers page, that it renders a Current openings section into the first-party #job-listings container, and that the official script at https://www.presto-apps.com/assets/js/js-p2023.js hardcodes the public jobPostings array with LinkedIn apply URLs for the listed openings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'presto/jobs.json',
}

export default PRESTO_CATALOG
