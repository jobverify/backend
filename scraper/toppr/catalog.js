import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TOPPR_CATALOG = {
  source: 'toppr',
  companyName: 'Toppr',
  officialBrandName: 'Toppr',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'toppr/jobs.json',
  homepageUrl: 'https://www.toppr.com/',
  companyCareerPage: 'https://www.toppr.com/careers',
  standaloneJobsBoardUrl: 'https://toppr.jobsoid.com/',
  companyDomain: 'toppr.com',
  atsPlatform: 'exact-name-domain-unverifiable-no-trustworthy-first-party-careers',
  countryFilter: 'India',
  paginationStrategy: 'expected-toppr-careers-route-unverifiable-plus-unlinked-jobsoid-board',
  extractionStrategy:
    'exact-name-careers-route-unverifiable+standalone-jobsoid-board-not-linked-from-first-party-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that standard transport verification of https://www.toppr.com/ and https://www.toppr.com/careers from this workspace failed on the exact-name Toppr domain, and that the standalone board at https://toppr.jobsoid.com/ showed "Current Openings", "No Current Openings", and "We hire with Jobsoid" but was not verified on or clearly linked from a trustworthy first-party Toppr page. There is therefore no trustworthy first-party public jobs surface for exact-name Toppr as of July 17, 2026, so this provider intentionally fails closed and returns an empty array until Toppr publishes a verifiable first-party public jobs surface.',
}

export default TOPPR_CATALOG
