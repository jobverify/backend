import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://epifi.com/ redirects to the live Fi Money site at https://fi.money/, that https://fi.money/careers is the live first-party careers page, and that this page links VIEW OPEN ROLES to the public Lever board at https://jobs.lever.co/epifi. The public Lever postings API at https://api.lever.co/v0/postings/epifi?mode=json returned 6 public postings and 6 India roles, all with country code IN and Bangalore locations, and a live sample detail page was verified at https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86.'

export const EPIFI_CATALOG = {
  source: 'epifi',
  companyName: 'Epifi',
  officialBrandName: 'Fi Money',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'epifi/jobs.json',
  officialHomepageUrl: 'https://epifi.com/',
  resolvedHomepageUrl: 'https://fi.money/',
  companyCareerPage: 'https://fi.money/careers',
  companyDomain: 'fi.money',
  officialLeverBoardUrl: 'https://jobs.lever.co/epifi',
  leverApiUrl: 'https://api.lever.co/v0/postings/epifi?mode=json',
  verifiedIndiaCountryCode: 'IN',
  verifiedLeverPostingCount: 6,
  verifiedIndiaRoleCount: 6,
  verifiedLeverLocation: 'Bangalore',
  verifiedSampleJobUrl: 'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-redirect-plus-careers-validation-plus-lever-api',
  extractionStrategy:
    'verified-homepage-redirect+verified-careers-page+verified-lever-board+lever-postings-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EPIFI_CATALOG
