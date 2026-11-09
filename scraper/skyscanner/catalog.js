import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Current first-party jobs page loads the Skyscanner JobsApp bundle from js.skyscnr.com. Its executable fetch contract uses the exact Ashby board eb485598-6bf3-40a5-8560-d70150131305. Runtime extraction verifies that handoff and native role identities, preserves complete inventory evidence and keeps unknown India scope partial.'

export const SKYSCANNER_CATALOG = {
  source: 'skyscanner',
  companyName: 'Skyscanner',
  officialBrandName: 'Skyscanner',
  adapter: 'script',
  homepageUrl: 'https://www.skyscanner.net/',
  companyCareerPage: 'https://www.skyscanner.com/jobs/current-jobs',
  officialCareersPageUrl: 'https://www.skyscanner.com/jobs/current-jobs',
  companyDomain: 'skyscanner.net',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'complete-native-ashby-single-response',
  extractionStrategy:
    'current-employer-executable-bundle-contract+validated-ashby-inventory+native-india-location',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  sourceBoundaryReviewedOn: '2026-11-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'skyscanner/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SKYSCANNER_CATALOG
