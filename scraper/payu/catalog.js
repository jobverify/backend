import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Follows the current own corporate redirect chain to the declared PayU Payments RMK publisher and its native pages. Current whole workplaces, exact employer, original public job identity, native criteria and dates, and same-role application handoff must reconcile. Bounded own role details retain explicit partial status; company totals, application activation and cleanup remain unverified. Counts require a current runtime assessment.'

export const PAYU_CATALOG = {
  source: 'payu',
  companyName: 'PayU',
  officialBrandName: 'PayU India',
  adapter: 'script',
  homepageUrl: 'https://corporate.payu.in/',
  companyCareerPage: 'https://corporate.payu.in/careers/',
  globalJobBoardUrl: 'https://careers.payu.in/PayU/go/_/514880/',
  companyDomain: 'corporate.payu.in',
  atsPlatform: 'successfactors-rmk',
  countryFilter: 'India',
  paginationStrategy: 'current-own-corporate-redirects-and-native-declared-result-pages-with-whole-listing-closing',
  extractionStrategy:
    'exact-native-PayU-Payments-publisher+whole-India-workplaces+bounded-own-role-and-same-job-application-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  backfillMode: 'live-parser',
  scraperTimeoutMs: 180000,
  authoritativeCurrentPublication: true,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedOn: null,
  verifiedGlobalJobCount: null,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'payu/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PAYU_CATALOG
