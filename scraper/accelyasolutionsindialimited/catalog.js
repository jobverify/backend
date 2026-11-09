import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Current runtime verifies the active first-party View all jobs handoff, the complete unfiltered Workday CXS inventory, every native country and selected full description, exact hiring employer, and closing inventory. The 2026-10-29 snapshot contained thirteen postings and nine India roles. Historical Location_Country queries returned HTTP_400; current enumeration uses no country or keyword filter.'

export const ACCELYA_SOLUTIONS_INDIA_LIMITED_CATALOG = {
  source: 'accelyasolutionsindialimited',
  companyName: 'Accelya Solutions India Limited',
  officialBrandName: 'Accelya',
  adapter: 'script',
  homepageUrl: 'https://w3.accelya.com/',
  companyCareerPage: 'https://w3.accelya.com/careers/',
  officialWorkdayBoardUrl: 'https://accelya.wd103.myworkdayjobs.com/Careers',
  jobsApiUrl: 'https://accelya.wd103.myworkdayjobs.com/wday/cxs/accelya/Careers/jobs',
  companyDomain: 'w3.accelya.com',
  atsPlatform: 'officially-linked-workday-cxs',
  countryFilter: 'India',
  paginationStrategy: 'complete-unfiltered-workday-country-proof',
  extractionStrategy:
    'current-first-party-handoff+complete-native-board+native-country+full-details+closing-reconciliation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-29',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'accelyasolutionsindialimited/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ACCELYA_SOLUTIONS_INDIA_LIMITED_CATALOG
