import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ADDA247_CATALOG = {
  source: 'adda247',
  companyName: 'Adda247',
  adapter: 'script',
  companyCareerPage: 'https://www.adda247.com/careers.html',
  companyDomain: 'adda247.com',
  countryFilter: 'India',
  atsPlatform: 'keka',
  paginationStrategy: 'configured-native-Keka-array+two-public-detail-passes+final-after-details-listing',
  extractionStrategy: 'configured-native-tenant+organization+role-identity;current-corporate-handoff-unverified',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  historicalHandoffVerifiedOn: '2026-07-19',
  currentPublicContractReviewedOn: '2026-11-03',
  corporateHandoffVerified: false,
  sourceScopeComplete: false,
  sourceCompanyWideScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    'The historical https://www.adda247.com/careers.html handoff to https://adda247.kekahire.com/ is not currently revalidated: the corporate host returned HTTP403. The independently configured https://adda247.keka.com/careers/ board currently binds Adda247 through its native tenant, organization and public role pages. Full public India jobs are retained; empty/punctuation descriptions are held. Unknown company totals and cleanup restrictions remain explicit. No private application fields are a prerequisite for public descriptions.',
  externalHandoffUrl: 'https://adda247.kekahire.com/',
  kekaCareersUrl: 'https://adda247.keka.com/careers/',
  kekaActiveJobsApiUrl: 'https://adda247.keka.com/careers/api/jobs/default/active',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ADDA247_CATALOG
