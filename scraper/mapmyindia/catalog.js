import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.mapmyindia.com/careers/ is the live first-party MapmyIndia careers page, that it exposes 3 inline public job cards for Android Developer, IOS Developer, and Inside Sales Executive, and that the same verified surface publishes the first-party recruiting contact hr@mapmyindia.com. The official careers page does not expose distinct public per-role URLs or a public ATS handoff, so the provider returns page-anchored listings from the verified first-party careers page only.'

export const MAPMYINDIA_CATALOG = {
  source: 'mapmyindia',
  companyName: 'MapmyIndia',
  officialBrandName: 'C.E. Info Systems Ltd. (MapmyIndia)',
  adapter: 'script',
  homepageUrl: 'https://www.mapmyindia.com/',
  companyCareerPage: 'https://www.mapmyindia.com/careers/',
  publicBoardUrl: 'https://www.mapmyindia.com/careers/',
  companyDomain: 'mapmyindia.com',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-inline-careers-page',
  extractionStrategy: 'verified-first-party-inline-job-cards+no-public-per-role-url+page-anchored-listings-only',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedPublicOpeningCount: 3,
  verifiedApplicationContact: 'hr@mapmyindia.com',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'mapmyindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MAPMYINDIA_CATALOG
