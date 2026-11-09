import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.dozeehealth.ai/ is the live official homepage for Dozee, that https://www.dozeehealth.ai/careers is the live first-party careers page, and that this page links job openings to the public Lever board at https://jobs.lever.co/dozee. The public Lever postings API at https://api.lever.co/v0/postings/dozee?mode=json returned 32 public postings, including 24 India roles with country code IN, and a live India sample detail page was verified at https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738.'

export const DOZEE_CATALOG = {
  source: 'dozee',
  companyName: 'Dozee',
  officialBrandName: 'Dozee',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'dozee/jobs.json',
  officialHomepageUrl: 'https://www.dozeehealth.ai/',
  companyCareerPage: 'https://www.dozeehealth.ai/careers',
  companyDomain: 'dozeehealth.ai',
  officialLeverBoardUrl: 'https://jobs.lever.co/dozee',
  leverApiUrl: 'https://api.lever.co/v0/postings/dozee?mode=json',
  verifiedIndiaCountryCode: 'IN',
  verifiedLeverPostingCount: 32,
  verifiedIndiaRoleCount: 24,
  verifiedSampleIndiaJobUrl: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-plus-careers-validation-plus-lever-api',
  extractionStrategy:
    'verified-first-party-homepage+verified-careers-page+verified-lever-board+lever-postings-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DOZEE_CATALOG
