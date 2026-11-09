import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PEOPLESTRONG_TECHNOLOGIES_CATALOG = {
  source: 'peoplestrongtechnologies',
  companyName: 'PeopleStrong Technologies',
  officialBrandName: 'PeopleStrong',
  adapter: 'script',
  homepageUrl: 'https://careers.peoplestrong.com/',
  companyCareerPage: 'https://careers.peoplestrong.com/',
  jobListUrl: 'https://careers.peoplestrong.com/job/joblist',
  alternateJobListUrl: 'https://careers.peoplestrong.com/job/openings',
  jobsApiUrl: 'https://careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  sampleJobDetailUrl: 'https://careers.peoplestrong.com/job/detail/PST_SDE_1615631',
  companyDomain: 'careers.peoplestrong.com',
  atsPlatform: 'official-company-careers-api',
  countryFilter: 'India',
  paginationStrategy: 'offset-limit-to-totalRecords',
  extractionStrategy:
    'verified-official-portal+schema-validated-public-requisitions-api+explicit-successful-zero-state',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the first-party PeopleStrong portal and sample detail route remain live. The public list routes return their known 404 shells, while the public jobs API returns an explicit successful zero-requisition payload with totalRecords 0, response null and messageCode code 200/messages success. Nonempty responses are validated and paginated by offset until totalRecords; backend errors and contradictory empty responses fail closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'peoplestrongtechnologies/jobs.json',
}

export default PEOPLESTRONG_TECHNOLOGIES_CATALOG
