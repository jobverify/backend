import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://wearemeru.com/ is the live official homepage, that https://wearemeru.com/careers/ is the first-party careers page, and that page hands applicants to the public Lever board at https://jobs.lever.co/wearemeru. The public Lever postings API at https://api.lever.co/v0/postings/wearemeru?mode=json returned 10 public postings, all in the United States, so there were no India roles live for Meru on Thursday, July 16, 2026.'

export const MERU_CATALOG = {
  source: 'meru',
  companyName: 'Meru',
  officialBrandName: 'MERU',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'meru/jobs.json',
  homepageUrl: 'https://wearemeru.com/',
  companyCareerPage: 'https://wearemeru.com/careers/',
  companyDomain: 'wearemeru.com',
  officialLeverBoardUrl: 'https://jobs.lever.co/wearemeru',
  leverApiUrl: 'https://api.lever.co/v0/postings/wearemeru?mode=json',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-validation-plus-lever-api',
  extractionStrategy:
    'verified-first-party-homepage+verified-first-party-careers-page+verified-lever-board+lever-postings-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MERU_CATALOG
