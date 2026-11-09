import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.delphix.com/ redirects to the live Delphix product page at https://www.perforce.com/products/delphix, and that the official Perforce careers page at https://www.perforce.com/careers links Browse Open Positions to the public Lever board at https://jobs.lever.co/perforce. All six current postings in the public Lever API at https://api.lever.co/v0/postings/perforce?mode=json also appear on the board. One role is in Pune, Maharashtra, but no role is Delphix-branded, so there are 0 Delphix India roles.'

export const DELPHIX_INDIA_CATALOG = {
  source: 'delphixindia',
  companyName: 'Delphix India',
  officialBrandName: 'Delphix',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'delphixindia/jobs.json',
  officialHomepageUrl: 'https://www.delphix.com/',
  resolvedHomepageUrl: 'https://www.perforce.com/products/delphix',
  companyCareerPage: 'https://www.perforce.com/careers',
  companyDomain: 'delphix.com',
  officialLeverBoardUrl: 'https://jobs.lever.co/perforce',
  leverApiUrl: 'https://api.lever.co/v0/postings/perforce?mode=json',
  brandKeyword: 'Delphix',
  verifiedIndiaLocationName: 'Pune, Maharashtra',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-redirect-plus-careers-validation-plus-lever-api',
  extractionStrategy:
    'verified-delphix-homepage-redirect+verified-perforce-careers-page+verified-lever-board+lever-postings-api+board-api-zero-check+delphix-brand-filter+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DELPHIX_INDIA_CATALOG
