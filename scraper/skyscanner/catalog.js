import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'The current own JobsApp programme supplies the native Ashby account dynamically. Its connected default GET and complete listed-job selection are inspected without executing or pinning a UI build. A fetched zero is qualified only for the current complete configured feed typed-India-workplace projection after independent opening/closing observations: all listed roles require exact native identity/application/account and decisive whole foreign workplace countries. Positive India rows, unknown countries, changed membership, pagination, unavailable or contradictory models cannot establish zero. Whole company inventory, country facets, legal employing entities, application activation and cleanup remain unqualified.'

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
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 180000,
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
