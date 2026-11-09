import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FRUGAL_TESTING_CATALOG = {
  source: 'frugaltesting',
  companyName: 'Frugal Testing',
  officialBrandName: 'Frugal Testing',
  adapter: 'script',
  homepageUrl: 'https://www.frugaltesting.com/',
  companyCareerPage: 'https://www.frugaltesting.com/careers',
  applicationFormUrl: 'https://www.frugaltesting.com/apply-to-frugal-testing',
  companyDomain: 'frugaltesting.com',
  atsPlatform: 'official-first-party-job-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-listing+first-party-job-detail-pages+shared-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.frugaltesting.com/careers is the live first-party careers page for Frugal Testing, that it lists public openings including Sales Executive, Senior QA Engineer, and Junior Graphic Designer in Hyderabad, and that the first-party detail pages under /job-openings/ plus the application form at /apply-to-frugal-testing remain publicly reachable.',
  dryRunFile: 'frugaltesting/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FRUGAL_TESTING_CATALOG
