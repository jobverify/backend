import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FUTRAN_SOLUTIONS_CATALOG = {
  source: 'futransolutions',
  companyName: 'Futran Solutions',
  adapter: 'script',
  homepageUrl: 'https://futransolutions.com/',
  companyCareerPage: 'https://futransolutions.com/careers/',
  atsPlatform: 'official-company-site-no-live-openings',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-without-public-job-listings',
  extractionStrategy: 'verified-first-party-careers-page+submit-profile-intake-form+returns-empty-array',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'futransolutions.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://futransolutions.com/careers/ was the live first-party Futran careers page, that it presented Careers and Submit Your Profile intake content plus an equal opportunity statement, and that it exposed no trustworthy public job cards or role detail pages.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'futransolutions/jobs.json',
}

export default FUTRAN_SOLUTIONS_CATALOG
