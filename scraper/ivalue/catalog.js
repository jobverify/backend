import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Current rendered corporate careers page visibly hands off to the exact iValue Group GreytHR board. Direct corporate HTTP currently returns an Incapsula interstitial; that response is not identity proof. The source requires an active current handoff or a fresh approved browser binding plus exact current native company identity, full public feed, matching role details, known location categories and final feed/category reconciliation. Runtime counts are separate. Browser binding expires after 48 hours; fetchOfficialPage supports fresh browser-backed renewal when direct corporate navigation remains blocked.'

export const IVALUE_CATALOG = {
  source: 'ivalue',
  companyName: 'iValue',
  officialBrandName: 'iValue Group',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'ivalue/jobs.json',
  companyCareerPage: 'https://ivaluegroup.com/en-in/careers/working-at-ivalue/',
  legacyCareerPageUrl: 'https://ivaluegroup.com/working-at-ivalue/',
  verifiedPublicJobsPageUrl: 'https://ivgroup.greythr.com/hire/jobs/',
  companyDetailsUrl: 'https://ivgroup.greythr.com/hire/api/career/get_company_details/',
  employmentCategoriesUrl: 'https://ivgroup.greythr.com/hire/api/greythr/emp-category/',
  jobsApiUrl: 'https://ivgroup.greythr.com/hire/api/career/published_jobs/',
  companyDomain: 'ivaluegroup.com',
  officialHomepageUrl: 'https://ivaluegroup.com/',
  atsPlatform: 'greythr',
  countryFilter: 'India',
  paginationStrategy: 'native-public-full-feed-and-final-feed-category-reconciliation',
  extractionStrategy:
    'current-official-handoff-or-fresh-approved-binding+exact-native-company+full-feed-and-matching-full-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  approvedCorporateBinding: {
    verified: true,
    checkedAt: '2026-10-20T23:05:21.486Z',
    officialURL: 'https://ivaluegroup.com/en-in/careers/working-at-ivalue/',
    target: 'https://ivgroup.greythr.com/hire/jobs/',
    provenance: 'current-rendered-public-official-corporate-navigation-no-forms',
    proofFile: 'fixtures/official-browser-binding-20261020.json',
    proofSha256: '7a0c4487c6b2c3859628c65234e00f8c3659630b6b862cc5a55753ea78201d0e',
  },
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default IVALUE_CATALOG
