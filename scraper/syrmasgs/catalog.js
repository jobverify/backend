import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SYRMA_SGS_CATALOG = {
  source: 'syrmasgs',
  companyName: 'Syrma SGS',
  adapter: 'script',
  companyCareerPage: 'https://syrmasgs.com/job-openings/',
  officialCareersPageUrl: 'https://syrmasgs.com/job-openings/',
  lifeAtUrl: 'https://syrmasgs.com/life-at-syrmasgs/',
  verifiedSampleJobUrl: 'https://syrmasgs.com/jobs/manager-sr-manager-npi-engineering/',
  verifiedSampleSecondaryJobUrl: 'https://syrmasgs.com/jobs/22188/',
  officialBrandName: 'Syrma SGS',
  atsPlatform: 'wp-job-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-verified-jobs-archive-plus-detail-pages',
  extractionStrategy:
    'verified-first-party-life-page+verified-jobs-archive+verified-detail-pages+inline-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'syrmasgs.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://syrmasgs.com/life-at-syrmasgs/ was the live first-party Syrma SGS careers page, that it pointed candidates to the public first-party jobs archive at https://syrmasgs.com/job-openings/, and that the archive exposed public role detail pages including https://syrmasgs.com/jobs/manager-sr-manager-npi-engineering/ and https://syrmasgs.com/jobs/22188/. Those verified detail pages still exposed inline "Apply for this position" resume forms on the first-party Syrma SGS domain.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SYRMA_SGS_CATALOG
