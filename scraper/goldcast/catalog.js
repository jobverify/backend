import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.goldcast.io/ is the live Goldcast homepage and that its footer links to https://www.goldcast.io/company/careers. Verified that the careers page remains a first-party shell titled "Join The Gold Standard of B2B Event Tech | Goldcast Careers" with Careers @ Goldcast, Great team backed by exceptional investors/advisors, and Stay In Touch, but no trustworthy public job cards, ATS links, or JobPosting markup. The scraper therefore returns an empty array until a real public jobs surface appears.'

export const GOLDCAST_CATALOG = {
  source: 'goldcast',
  companyName: 'Goldcast',
  officialBrandName: 'Goldcast',
  adapter: 'script',
  homepageUrl: 'https://www.goldcast.io/',
  companyCareerPage: 'https://www.goldcast.io/company/careers',
  companyDomain: 'goldcast.io',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-shell-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-page-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'goldcast/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GOLDCAST_CATALOG
