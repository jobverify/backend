import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SECPOD_CATALOG = {
  source: 'secpod',
  companyName: 'SecPod',
  officialBrandName: 'SecPod',
  adapter: 'script',
  homepageUrl: 'https://www.secpod.com/',
  companyCareerPage: 'https://www.secpod.com/careers',
  companyDomain: 'secpod.com',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-empty-openings-validation',
  extractionStrategy:
    'verified-careers-page+verified-empty-current-openings-section+no-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.secpod.com/careers is the official first-party SecPod careers page. The page still presents the branded "Current Job Openings" section, but it exposes no trustworthy public job listings, ATS handoff links, or public requisition detail pages. The local provider therefore fails closed and returns an empty result until SecPod publishes a trustworthy public jobs surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'secpod/jobs.json',
}

export default SECPOD_CATALOG
