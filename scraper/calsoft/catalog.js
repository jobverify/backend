import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CALSOFT_CATALOG = {
  source: 'calsoft',
  companyName: 'Calsoft',
  officialBrandName: 'Calsoft',
  adapter: 'script',
  homepageUrl: 'https://www.calsoftinc.com/',
  companyCareerPage: 'https://www.calsoftinc.com/career',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'native-client-inventory-unqualified',
  extractionStrategy: 'reject-unqualified-initial-empty-display',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'calsoftinc.com',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedGlobalJobCount: null,
  verifiedInventoryStatus: 'unverified',
  zeroResultPolicy: 'evidence-required',
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    'The first-party careers page renders an initial client empty display. Its 0 Results and No jobs found text cannot certify an empty inventory. Native records still require independent publication, employer, country and application proof; company inventory and lifecycle cleanup remain unqualified.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CALSOFT_CATALOG
