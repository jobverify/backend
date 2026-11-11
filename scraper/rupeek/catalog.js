import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RUPEEK_CATALOG = {
  source: 'rupeek',
  companyName: 'Rupeek',
  officialBrandName: 'Rupeek',
  adapter: 'script',
  companyCareerPage: 'https://rupeek.com/careers',
  officialCareersPageUrl: 'https://rupeek.com/about/careers',
  officialCareersCanonicalUrl: 'https://rupeek.com/careers',
  companyDomain: 'rupeek.com',
  atsPlatform: 'linkedin-company-jobs',
  countryFilter: 'India',
  paginationStrategy: 'bounded-corporate-page+up-to20-own-details+closing-corporate-and-role-reconciliation',
  extractionStrategy: 'reviewed-corporate-react-reveal+explicit-country-labels+own-linkedin-identity-publisher-full-criteria',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-11',
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  nativeLegalEmployer: null,
  verificationDisposition: 'current-corporate-role-cards-own-detail-read-rate-limited-incomplete',
  verifiedSurfaceSummary:
    'Reviewed November 11, 2026 (public captures November 10 UTC): https://rupeek.com/about/careers declares canonical https://rupeek.com/careers and 15 corporate role cards through a reviewed React server reveal. All 15 card locations explicitly name India. One own LinkedIn response establishes a bounded identity, publisher, country and full-criteria parsing contract; the current source read stopped at its first HTTP 429 after 12 original responses, with no actual closing reads. Current source recovery, native vacancy totals, whole-company coverage and legal employer remain unverified; cleanup is held.',
  dryRunFile: 'rupeek/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RUPEEK_CATALOG
