import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.matrimony.com/careers is the live official Matrimony.com careers page, that its Apply Now handoff points to the public PeopleStrong portal at https://matrimonycareers.peoplestrong.com/, that the Candidate Portal shell there is live, and that the public jobs API at https://matrimonycareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20 returned 1 public job during verification.'

export const MATRIMONYCOM_CATALOG = {
  source: 'matrimonycom',
  companyName: 'Matrimony.com',
  officialBrandName: 'Matrimony.com Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'matrimonycom/jobs.json',
  officialBrandSiteUrl: 'https://www.matrimony.com/',
  companyCareerPage: 'https://www.matrimony.com/careers',
  portalOrigin: 'https://matrimonycareers.peoplestrong.com',
  jobListingsUrl: 'https://matrimonycareers.peoplestrong.com/',
  jobsApiUrl:
    'https://matrimonycareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  companyDomain: 'matrimonycareers.peoplestrong.com',
  atsPlatform: 'peoplestrong',
  countryFilter: 'India',
  verifiedPublicJobCount: 1,
  paginationStrategy: 'official-careers-page-plus-peoplestrong-offset-limit-api',
  extractionStrategy: 'official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MATRIMONYCOM_CATALOG
