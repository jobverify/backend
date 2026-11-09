import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Current runtime verifies the first-party legal employer, careers and job-list handoff, exact public listing/detail/application clients, unfiltered openpositionlist and a closing snapshot. Published roles are expanded through openpositionsingleview and the client-declared public full PDF. HTTP failures remain failures; catalog metadata alone cannot prove empty inventory.'

export const LAVA_INTERNATIONAL_CATALOG = {
  source: 'lavainternational',
  companyName: 'Lava International',
  officialBrandName: 'Lava International Limited',
  adapter: 'script',
  homepageUrl: 'https://www.lavamobiles.com/',
  aboutPageUrl: 'https://www.lavamobiles.com/aboutus',
  companyCareerPage: 'https://www.lavamobiles.com/career',
  applicationEmail: null,
  applicationUrl: 'https://www.lavamobiles.com/career/joblist',
  companyDomain: 'lavamobiles.com',
  atsPlatform: 'official-company-site-openposition-api',
  countryFilter: 'India',
  paginationStrategy: 'native-unfiltered-all-roles+full-pdf+closing-snapshots-before-cap',
  extractionStrategy: 'current-first-party-clients+full-native-role-and-pdf+explicit-work-country',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedInventoryStatus: 'unverified',
  zeroResultPolicy: 'coverage-gap',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'lavainternational/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LAVA_INTERNATIONAL_CATALOG
