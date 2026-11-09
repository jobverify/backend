import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INGENERO_TECHNOLOGIES_CATALOG = {
  source: 'ingenerotechnologies',
  companyName: 'Ingenero Technologies',
  officialBrandName: 'Ingenero',
  adapter: 'script',
  homepageUrl: 'https://ingenero.com/',
  companyCareerPage: 'https://ingenero.com/career/',
  atsPlatform: 'official-first-party-cv-submission-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-validation',
  extractionStrategy: 'verified-first-party-careers-form-without-trustworthy-public-job-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ingenero.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://ingenero.com/career/ remained the live first-party Ingenero careers page and that it currently exposes a CV Submission Form with Name, Email, and Upload CV fields plus India office contact details, but no trustworthy public requisition list, role detail pages, or job-specific apply routes. This provider therefore stays fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INGENERO_TECHNOLOGIES_CATALOG
