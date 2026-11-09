import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.webskitters.com/career was the live first-party Webskitters careers page but the embedded WPJobBoard list rendered the explicit empty state "No job listings found." while still exposing the active RSS endpoint shell. This local provider therefore stays fail-closed and returns an empty set until Webskitters publishes real first-party listings again.'

export const WEBSKITTERS_CATALOG = {
  source: 'webskitters',
  companyName: 'Webskitters',
  officialBrandName: 'Webskitters',
  adapter: 'script',
  homepageUrl: 'https://www.webskitters.com/',
  companyCareerPage: 'https://www.webskitters.com/career',
  officialCareersPageUrl: 'https://www.webskitters.com/career',
  companyDomain: 'webskitters.com',
  atsPlatform: 'official-careers-page-wpjobboard-empty-state',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-wpjobboard-empty-state-validation',
  extractionStrategy:
    'verified-first-party-careers-page+verified-wpjobboard-empty-state+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'webskitters/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default WEBSKITTERS_CATALOG
