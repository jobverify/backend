import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://careers.makemytrip.com/ is the live first-party MakeMyTrip careers origin, that https://careers.makemytrip.com/prod/jobs renders the branded public jobs shell, that https://careers.makemytrip.com/api/jobs returns 36 public jobs on the verified date, that https://careers.makemytrip.com/api/jobDetails?jobId=a679c58dda0f87 returns the live detail payload for Marketing Analytics with group company MakeMyTrip (India) Limited, and that the public first-party opportunity route https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics resolves successfully.'

export const MAKEMYTRIP_CATALOG = {
  source: 'makemytrip',
  companyName: 'MakeMyTrip',
  officialBrandName: 'MakeMyTrip',
  adapter: 'script',
  homepageUrl: 'https://careers.makemytrip.com/',
  companyCareerPage: 'https://careers.makemytrip.com/prod/jobs',
  careersLandingUrl: 'https://careers.makemytrip.com/',
  careersOrigin: 'https://careers.makemytrip.com',
  jobsApiUrl: 'https://careers.makemytrip.com/api/jobs',
  jobDetailsApiBaseUrl: 'https://careers.makemytrip.com/api/jobDetails?jobId=',
  companyDomain: 'makemytrip.com',
  atsPlatform: 'first-party-careers-api',
  countryFilter: 'India',
  verifiedPublicJobCount: 36,
  verifiedSampleJobTitle: 'Marketing Analytics',
  verifiedSampleGroupCompany: 'MakeMyTrip (India) Limited',
  verifiedSampleJobUrl:
    'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
  paginationStrategy: 'first-party-single-jobs-api-array',
  extractionStrategy:
    'verified-first-party-careers-shell+jobs-api+job-details-api+opportunity-route',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'makemytrip/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MAKEMYTRIP_CATALOG
