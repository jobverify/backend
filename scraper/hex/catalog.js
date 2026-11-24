import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HEX_CATALOG = {
  source: 'hex',
  companyName: 'Hex',
  officialBrandName: 'Hex',
  adapter: 'script',
  homepageUrl: 'https://hex.tech/',
  companyCareerPage: 'https://hex.tech/careers/',
  sampleRoleUrls: [
    'https://hex.tech/careers/software-engineer-backend-%28platform%29/',
    'https://hex.tech/careers/cloud-security-engineer/',
  ],
  atsPlatform: 'first-party-published-jobposting',
  countryFilter: 'India',
  paginationStrategy: 'paired-single-page-index-and-all-own-roles',
  extractionStrategy: 'semantic-native-count+all-own-jobpostings+explicit-typed-countries',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'hex.tech',
  scraperTimeoutMs: 360000,
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  companyGlobalTotal: null,
  companyIndiaTotal: null,
  verifiedOn: '2026-11-20',
  verifiedSurfaceSummary:
    'Reads the current own careers count and every advertised own role twice using original public GET Responses. Each same-role JobPosting must retain its publisher, title, full criteria, original publication dates, all explicit typed foreign workplace alternatives, and native selector identity. The configured own-listing India projection can report fetched-zero only after both complete inventories agree. Company totals, legal employer, application activation, and lifecycle cleanup remain unverified; office cities alone do not establish country.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HEX_CATALOG
