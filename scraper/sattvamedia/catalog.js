import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SATTVA_MEDIA_CATALOG = {
  source: 'sattvamedia',
  companyName: 'Sattva Media',
  officialBrandName: 'Sattva Consulting',
  legalEntityName: 'Sattva Media and Consulting Private Limited',
  adapter: 'script',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 300000,
  sourceDeadlineMs: 240000,
  companyCareerPage: 'https://www.sattva.co.in/join-us/careers/',
  homepageUrl: 'https://www.sattva.co.in/join-us/',
  officialCareersPageUrl: 'https://www.sattva.co.in/join-us/careers/',
  officialJobsBoardUrl: 'https://careers.kula.ai/sattva',
  detailUrlPattern: 'https://careers.kula.ai/sattva/{id}-{slug}',
  companyDomain: 'sattva.co.in',
  atsPlatform: 'current-own-corporate-declared-kula-native-published-role-models',
  countryFilter: 'India',
  paginationStrategy: 'current-corporate-and-native-listing-protocol-opening-closing-before-bounded-50-own-role-pairs',
  extractionStrategy: 'current-literal-JobsListing-owner+connected-native-slug-and-Apply-link-business-AST+same-role-native-offices-and-JobPosting+explicit-partials+ongoing-intake-held',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Current own corporate careers declares the exact Kula account; independent corporate/privacy/listing/program closing precedes bounded native role reads. Literal data is bound to the current JobsListing import and connected native link/slug business functions without executing or pinning a UI build. Same-role native offices, JobPosting identity/workplaces/employer and authored Apply intent qualify explicit partials. Native criteria/date variants and all original responses remain retained; ongoing intake is held. Legal employing entity, full renderer/form controls/backend, company inventory and cleanup remain unverified.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SATTVA_MEDIA_CATALOG
