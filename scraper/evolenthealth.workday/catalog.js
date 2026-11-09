import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.evolent.com/careers is the live first-party Evolent careers page and directly links Search openings to the public Workday board at https://evolent.wd1.myworkdayjobs.com/External. That first-party careers page also states Evolent is hiring for roles in India and the Philippines. The public Workday jobs API at https://evolent.wd1.myworkdayjobs.com/wday/cxs/evolent/External/jobs exposes stable location facets for Pune, Philippines, and Work at Home, and returns 10 Pune jobs when filtered to the verified Pune location, including https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402 and its public apply URL.'

export const EVOLENT_HEALTH_CATALOG = {
  source: 'evolenthealth',
  companyName: 'Evolent Health',
  officialBrandName: 'Evolent',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'evolenthealth.workday/jobs.json',
  companyCareerPage: 'https://www.evolent.com/careers',
  companyDomain: 'evolent.com',
  officialHomepageUrl: 'https://www.evolent.com/',
  officialWorkdayBoardUrl: 'https://evolent.wd1.myworkdayjobs.com/External',
  jobsApiUrl: 'https://evolent.wd1.myworkdayjobs.com/wday/cxs/evolent/External/jobs',
  verifiedIndiaLocationDescriptors: ['Pune'],
  verifiedIndiaJobUrl:
    'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402',
  verifiedIndiaApplyUrl:
    'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402/apply',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-location-facet',
  extractionStrategy:
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+verified-pune-location-facet+filtered-workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EVOLENT_HEALTH_CATALOG
