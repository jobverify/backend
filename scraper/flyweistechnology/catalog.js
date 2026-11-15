import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FLYWEIS_TECHNOLOGY_CATALOG = {
  source: 'flyweistechnology',
  companyName: 'Flyweis Technology',
  officialBrandName: 'Flyweis Technology',
  adapter: 'script',
  homepageUrl: 'https://www.flyweis.technology/',
  companyCareerPage: 'https://flyweis.technology/careers',
  atsPlatform: 'first-party-server-rendered-careers',
  countryFilter: 'India',
  paginationStrategy: 'bounded-visible-native-cards-and-fresh-membership-closing',
  extractionStrategy: 'current-corporate-handoff+own-canonical+typed-schema-country+full-visible-authored-criteria+fresh-closing',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'flyweis.technology',
  verifiedOn: '2026-11-15',
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  zeroJobEvidencePolicy: 'required',
  verifiedSurfaceSummary:
    'Current official homepage links its native careers board. Individually verified own canonical roles retain the entire visible role article, native employer and typed country, reviewed CSS, and independent full-role, membership and corporate handoff closing reads. Whole-company scope and cleanup remain unqualified; empty results do not certify zero.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FLYWEIS_TECHNOLOGY_CATALOG
