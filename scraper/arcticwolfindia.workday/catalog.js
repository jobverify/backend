import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://arcticwolf.com/company/careers/ is the live first-party Arctic Wolf careers page and links View All Open Positions to the public Workday board at https://arcticwolf.wd1.myworkdayjobs.com/External. The public Workday jobs API at https://arcticwolf.wd1.myworkdayjobs.com/wday/cxs/arcticwolf/External/jobs exposes stable India location facets for Bengaluru, IND and Remote - IND - Karnataka, and returns 68 India roles when filtered to those two facets, including https://arcticwolf.wd1.myworkdayjobs.com/External/job/Bengaluru-IND/Senior-Quality-Engineer-2_R26_478 and its public apply URL.'

export const ARCTIC_WOLF_INDIA_CATALOG = {
  source: 'arcticwolfindia',
  companyName: 'Arctic Wolf India',
  officialBrandName: 'Arctic Wolf',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'arcticwolfindia.workday/jobs.json',
  companyCareerPage: 'https://arcticwolf.com/company/careers/',
  companyDomain: 'arcticwolf.com',
  officialHomepageUrl: 'https://arcticwolf.com/',
  officialWorkdayBoardUrl: 'https://arcticwolf.wd1.myworkdayjobs.com/External',
  jobsApiUrl: 'https://arcticwolf.wd1.myworkdayjobs.com/wday/cxs/arcticwolf/External/jobs',
  verifiedIndiaLocationDescriptors: [
    'Bengaluru, IND',
    'Remote - IND - Karnataka',
  ],
  verifiedIndiaJobUrl:
    'https://arcticwolf.wd1.myworkdayjobs.com/External/job/Bengaluru-IND/Senior-Quality-Engineer-2_R26_478',
  verifiedIndiaApplyUrl:
    'https://arcticwolf.wd1.myworkdayjobs.com/External/job/Bengaluru-IND/Senior-Quality-Engineer-2_R26_478/apply',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-locations-facet',
  extractionStrategy:
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+india-location-facets+filtered-workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ARCTIC_WOLF_INDIA_CATALOG
