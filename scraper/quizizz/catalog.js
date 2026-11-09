import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 17, 2026 that the exact-name first-party careers URL https://quizizz.com/home/careers?lng=en redirects to the official careers page at https://wayground.com/home/careers?lng=en, which is branded Wayground (formerly Quizizz) and identifies the company as Quizizz Inc. (DBA Wayground). Verified that the page links public jobs to https://jobs.lever.co/Wayground and that the public Lever postings API at https://api.lever.co/v0/postings/Wayground?mode=json returned 4 public postings, including 4 India roles with country code IN, and a live India sample detail page at https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2.'

export const QUIZIZZ_CATALOG = {
  source: 'quizizz',
  companyName: 'Quizizz',
  officialBrandName: 'Wayground (formerly Quizizz)',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'quizizz/jobs.json',
  officialHomepageUrl: 'https://quizizz.com/',
  companyCareerPage: 'https://quizizz.com/home/careers?lng=en',
  resolvedCareerPageUrl: 'https://wayground.com/home/careers?lng=en',
  companyDomain: 'quizizz.com',
  officialLeverBoardUrl: 'https://jobs.lever.co/Wayground',
  leverApiUrl: 'https://api.lever.co/v0/postings/Wayground?mode=json',
  verifiedIndiaCountryCode: 'IN',
  verifiedLeverPostingCount: 4,
  verifiedIndiaRoleCount: 4,
  verifiedSampleIndiaJobUrl: 'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-careers-redirect-plus-lever-api',
  extractionStrategy:
    'verified-exact-name-careers-url+verified-wayground-careers-page+verified-lever-board+lever-postings-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default QUIZIZZ_CATALOG
