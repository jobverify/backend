import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AUROBINDO_PHARMA_CATALOG = {
  source: 'aurobindopharma',
  companyName: 'Aurobindo Pharma',
  officialBrandName: 'Aurobindo Pharma',
  legalEntityName: 'Aurobindo Pharma Limited',
  adapter: 'script',
  companyCareerPage: 'https://www.aurobindo.com/careers',
  homepageUrl: 'https://www.aurobindo.com/',
  careersPageUrl: 'https://www.aurobindo.com/careers',
  careersHandoffUrl: 'https://aurobindo.talentrecruit.com/Search/',
  careersHostUrl: 'https://aurobindo.talentrecruit.com/',
  atsPlatform: 'official-company-careers-broken-handoff',
  countryFilter: 'India',
  paginationStrategy: "current-corporate-careers+exact-declared-native-handoff;stop-on-unavailable-inventory",
  extractionStrategy: "current-employer-handoff-binding+native-HTTP-evidence+explicit-unverified-inventory",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'aurobindo.com',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    "Current corporate careers declares the exact Aurobindo TalentRecruit Search handoff. HTTP404or an unavailable/unreviewed native board is an explicit unknown-inventory failure, never an empty board. Only declared public routes are read; no TalentRecruit host-root guess or private application action is used. Company totals and cleanup remain unknown.",
  modulePath: path.join(currentDir, 'script.js'),
}

export default AUROBINDO_PHARMA_CATALOG
