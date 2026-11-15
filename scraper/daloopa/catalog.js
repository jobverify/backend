import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LEGACY_DALOOPA_CATALOG = {
  source: 'daloopa',
  companyName: 'Daloopa',
  officialBrandName: 'Daloopa',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'daloopa/jobs.json',
  companyCareerPage: 'https://daloopa.com/careers',
  officialCareersPageUrl: 'https://daloopa.com/careers',
  companyDomain: 'daloopa.com',
  atsPlatform: 'official-company-careers-no-public-open-roles',
  countryFilter: 'India',
  paginationStrategy: 'verified-single-first-party-careers-page-without-public-role-cards',
  extractionStrategy: 'verified-first-party-careers-landing-page-without-public-open-roles',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://daloopa.com/careers is a live first-party Daloopa careers landing page with generic recruiting copy and Request a Demo / Create Free Account / Log In calls to action, but no public open role cards, no same-domain job detail links, and no trustworthy batch-safe public jobs contract.',
}

export const DALOOPA_CATALOG = {
  ...LEGACY_DALOOPA_CATALOG,
  modulePath: path.resolve(currentDir, 'nativeData20261115.js'),
  atsPlatform: 'mynexthire-native-data',
  paginationStrategy: 'complete11-ordered-native-rows;two-exact-india-criteria-data-pairs',
  extractionStrategy: 'whole-native-carriers-and-complete-raw-data-spans;native-criteria-as-data-only',
  parser: 'runtime-native-data-20261115',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  firstParty: false,
  sourceCorporateBindingQualified: false,
  formalLegalEmployerQualified: false,
  sourceActivationComplete: false,
  sourceRenderedCriteriaComplete: false,
  sourceApplicationQualificationComplete: false,
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  nativeObservedRecordCount: 11,
  nativeQualifiedIndiaCandidateCount: 2,
  nativeUnqualifiedCountryCount: 9,
  observedEligibleCount: null,
  verifiedSurfaceSummary: 'Own native client1165/declared Daloopa Private Limited/website daloopa.com and complete11-row native list expose two exact role-owned IndiaRemote rich criteria records46/45. Full4data/13role models, original rich and plain criteria, SSC and structured5-8 versus rich8+ tensions are retained. Native approvedOn is approval only; posting/expiry/action/canonical fields remain null. Exact actually200 encoded JD URLs are static app-root carriers without roleSSR/JobPosting. Current corporate/formallegal/program/CSS/rendered/application/company coverage and cleanup remain unqualified;9other country scopes held. Fourteen independent opening/closing reads are required, without generic fallback.',
}

export default DALOOPA_CATALOG
