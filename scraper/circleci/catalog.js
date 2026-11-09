import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CIRCLECI_CATALOG = {
  source: 'circleci',
  companyName: 'CircleCI',
  officialBrandName: 'CircleCI',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'circleci/jobs.json',
  companyCareerPage: 'https://circleci.com/careers/jobs/',
  companyDomain: 'circleci.com',
  atsPlatform: 'official-circleci-careers-greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'full-native-board-and-corporate-inventory-with-closing-comparison-before-caps',
  extractionStrategy:
    'active-corporate-role-greenhouse-embed+full-native-job-criteria+own-country-proof',
  parser: 'current-company-and-native-ats',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedInventoryStatus: 'discovery-only',
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    'Current official CircleCI role pages publish an active circleci Greenhouse embed and full matching employer criteria. Runtime enumerates the native board, verifies corporate role identities, retains original first_published dates and full descriptions, extracts proven India roles, and compares closing inventory and criteria before caller caps. Corporate/native count disagreements and unresolved native worksite countries retain discovery-only inventory; no city, generic remote label or historical snapshot proves an India zero.',
}

export default CIRCLECI_CATALOG
