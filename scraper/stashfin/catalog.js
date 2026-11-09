import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.stashfin.com/careers is the live first-party Stashfin careers page and that it publicly exposes 8 inline public job cards across Product Design, Product Management, and Software Development, including Frontend Engineer, all anchored to Gurgaon, India and Full-time. The verified surface showed duplicate UX Designer and Backend Engineer cards but no distinct public per-role URLs or separate ATS handoff, so this exact-name provider returns page-anchored listings from the verified first-party careers page only.'

export const STASHFIN_CATALOG = {
  source: 'stashfin',
  companyName: 'Stashfin',
  officialBrandName: 'Stashfin',
  adapter: 'script',
  homepageUrl: 'https://www.stashfin.com/',
  companyCareerPage: 'https://www.stashfin.com/careers',
  publicBoardUrl: 'https://www.stashfin.com/careers',
  companyDomain: 'stashfin.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-inline-careers-page',
  extractionStrategy:
    'verified-first-party-inline-job-cards+no-public-per-role-url+page-anchored-listings-only',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedPublicOpeningCount: 8,
  verifiedPrimaryLocation: 'Gurgaon, India',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'stashfin/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default STASHFIN_CATALOG
