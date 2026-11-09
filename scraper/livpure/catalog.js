import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.livpuresmart.com/ is the live first-party Livpure site exposing a Careers handoff to https://livpurerecruit-careers.peoplestrong.com/home, that the public PeopleStrong portal shell at https://livpurerecruit-careers.peoplestrong.com/home is live, and that the public jobs API at https://livpurerecruit-careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20 returned 0 public jobs during verification.'

export const LIVPURE_CATALOG = {
  source: 'livpure',
  companyName: 'Livpure',
  officialBrandName: 'Livpure Smart Homes Pvt Ltd',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'livpure/jobs.json',
  homepageUrl: 'https://www.livpuresmart.com/',
  companyCareerPage: 'https://www.livpuresmart.com/',
  portalOrigin: 'https://livpurerecruit-careers.peoplestrong.com',
  jobListingsUrl: 'https://livpurerecruit-careers.peoplestrong.com/home',
  jobsApiUrl:
    'https://livpurerecruit-careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  companyDomain: 'livpuresmart.com',
  atsPlatform: 'peoplestrong',
  countryFilter: 'India',
  verifiedPublicJobCount: 0,
  paginationStrategy: 'official-homepage-plus-peoplestrong-offset-limit-api-empty-board',
  extractionStrategy: 'verified-homepage+direct-peoplestrong-handoff+peoplestrong-jobs-api-empty-board',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default LIVPURE_CATALOG
