import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://www.everestglobal.com/ is the live exact-name Everest homepage, that https://www.everestglobal.com/careers/ resolves to the first-party careers overview at https://www.everestglobal.com/us-en/career-opportunities/overview, and that the refreshed overview now presents View Job Openings while still linking to the official public Workday board at https://wd5.myworkdaysite.com/recruiting/everestre/careers. Verified the public Workday jobs API at https://wd5.myworkdaysite.com/wday/cxs/everestre/careers/jobs and the official public Workday surface remains the trusted source for live openings.'

export const EVEREST_CATALOG = {
  source: 'everest',
  companyName: 'Everest',
  officialBrandName: 'Everest',
  adapter: 'script',
  homepageUrl: 'https://www.everestglobal.com/',
  companyCareerPage: 'https://www.everestglobal.com/careers/',
  careerOverviewUrl: 'https://www.everestglobal.com/us-en/career-opportunities/overview',
  officialJobsBoardUrl: 'https://wd5.myworkdaysite.com/recruiting/everestre/careers',
  jobsApiUrl: 'https://wd5.myworkdaysite.com/wday/cxs/everestre/careers/jobs',
  sampleJobDetailUrl:
    'https://wd5.myworkdaysite.com/recruiting/everestre/careers/job/Singapore/Associate-Underwriter--ERDP---Singapore_R6960',
  companyDomain: 'everestglobal.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-jobs-api-pagination',
  extractionStrategy:
    'verify-homepage+verify-careers-handoff+verify-workday-board+jobs-api-list-parse+grouped-detail-location-check+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'everest.workday/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EVEREST_CATALOG
