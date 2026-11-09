import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROPROFS_CATALOG = {
  source: 'proprofs',
  companyName: 'ProProfs',
  officialBrandName: 'ProProfs',
  adapter: 'script',
  homepageUrl: 'https://www.proprofs.com/',
  companyCareerPage: 'https://www.proprofs.com/about/',
  blockedCareersUrl: 'https://www.proprofs.com/careers',
  blockedJobsUrl: 'https://www.proprofs.com/jobs',
  companyDomain: 'proprofs.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-about-page-plus-common-careers-routes-blocked-validation',
  extractionStrategy:
    'verified-first-party-about-page+verified-common-careers-routes-abort+fail-closed-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026: https://www.proprofs.com/about/ resolved with the ProProfs brand and the Santa Monica plus Delhi-NCR office copy, while the exact-name first-party careers routes https://www.proprofs.com/careers and https://www.proprofs.com/jobs aborted during direct probes. No trustworthy public jobs surface was verified, so this local provider fails closed and returns [].',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default PROPROFS_CATALOG
