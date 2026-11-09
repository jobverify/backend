import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.directi.com/ is the live official Directi homepage and that it links Careers to https://careers.directi.com/. Verified that https://www.directi.com/careers returns a first-party 404 page, while https://careers.directi.com/ is the live Directi careers subdomain with a View job posting button that points to https://jobs.lever.co/directi. Verified that both https://jobs.lever.co/directi and https://api.lever.co/v0/postings/directi?mode=json currently return 404 responses, so there is no trustworthy public jobs surface for Directi on the verified date.'

export const DIRECTI_CATALOG = {
  source: 'directi',
  companyName: 'Directi',
  adapter: 'script',
  homepageUrl: 'https://www.directi.com/',
  companyCareerPage: 'https://careers.directi.com/',
  brokenLeverBoardUrl: 'https://jobs.lever.co/directi',
  brokenLeverApiUrl: 'https://api.lever.co/v0/postings/directi?mode=json',
  mainSiteCareers404Url: 'https://www.directi.com/careers',
  companyDomain: 'directi.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-subdomain-plus-broken-lever-handoff',
  extractionStrategy:
    'verified-homepage+verified-careers-subdomain+verified-broken-lever-board+verified-broken-lever-api-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'directi/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DIRECTI_CATALOG
