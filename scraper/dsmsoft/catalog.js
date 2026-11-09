import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DSM_SOFT_CATALOG = {
  source: 'dsmsoft',
  companyName: 'DSM SOFT',
  officialBrandName: 'DSM Soft',
  adapter: 'script',
  homepageUrl: 'https://dsmsoft.com/',
  companyCareerPage: 'https://dsmsoft.com/Careers.aspx',
  atsPlatform: 'official-first-party-resume-intake-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-form-validation',
  extractionStrategy:
    'verified-first-party-careers-form-without-trustworthy-public-job-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dsmsoft.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://dsmsoft.com/Careers.aspx is the live first-party DSM Soft careers page and that it presents a resume-intake form with the explicit handoff "Interested candidates can send the resume to hr_team@dsmsoft.com" plus service-area content, but no trustworthy public job listings, public requisitions, or dependable job-specific apply routes. This provider therefore stays fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DSM_SOFT_CATALOG
