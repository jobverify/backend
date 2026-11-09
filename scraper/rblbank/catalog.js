import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.rbl.bank.in/careers is the live official RBL Bank careers page, that its public "Job Opportunities" handoff points to https://rblcareers.peoplestrong.com/, that the public Candidate Portal shell there is live, and that the public jobs API at https://rblcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20 returned 4 public jobs during verification.'

export const RBLBANK_CATALOG = {
  source: 'rblbank',
  companyName: 'RBL Bank',
  officialBrandName: 'RBL Bank Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'rblbank/jobs.json',
  officialBrandSiteUrl: 'https://www.rbl.bank.in/',
  companyCareerPage: 'https://www.rbl.bank.in/careers',
  portalOrigin: 'https://rblcareers.peoplestrong.com',
  jobListingsUrl: 'https://rblcareers.peoplestrong.com/',
  jobsApiUrl:
    'https://rblcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  companyDomain: 'rblcareers.peoplestrong.com',
  atsPlatform: 'peoplestrong',
  countryFilter: 'India',
  verifiedPublicJobCount: 4,
  paginationStrategy: 'official-careers-page-plus-peoplestrong-offset-limit-api',
  extractionStrategy: 'official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default RBLBANK_CATALOG
