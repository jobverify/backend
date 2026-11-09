import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.mindtickle.com/ is the official Mindtickle homepage, that the first-party about page at https://www.mindtickle.com/about-us/ links open opportunities to the public Lever board at https://jobs.lever.co/mindtickle, and that the public Lever postings API at https://api.lever.co/v0/postings/mindtickle?mode=json returned 21 public postings including 19 India roles. A live India sample role was verified at https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95 in Pune, Maharashtra.'

export const MINDTICKLE_CATALOG = {
  source: 'mindtickle',
  companyName: 'MindTickle',
  officialBrandName: 'Mindtickle',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mindtickle/jobs.json',
  officialHomepageUrl: 'https://www.mindtickle.com/',
  companyCareerPage: 'https://www.mindtickle.com/about-us/',
  companyDomain: 'mindtickle.com',
  officialLeverBoardUrl: 'https://jobs.lever.co/mindtickle',
  leverApiUrl: 'https://api.lever.co/v0/postings/mindtickle?mode=json',
  verifiedIndiaCountryCode: 'IN',
  verifiedLeverPostingCount: 21,
  verifiedIndiaRoleCount: 19,
  verifiedSampleIndiaJobUrl:
    'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'official-about-page-plus-lever-api',
  extractionStrategy:
    'verified-first-party-about-page+verified-lever-board+lever-postings-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MINDTICKLE_CATALOG
