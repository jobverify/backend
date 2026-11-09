import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SENTRY_CATALOG = {
  source: 'sentry',
  companyName: 'Sentry',
  officialBrandName: 'Sentry',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sentry/jobs.json',
  companyCareerPage: 'https://sentry.io/careers',
  companyDomain: 'sentry.io',
  atsPlatform: 'official-sentry-careers-ashby',
  countryFilter: 'India',
  paginationStrategy: 'full-native-board-and-corporate-hydration-with-closing-comparison-before-caps',
  extractionStrategy:
    'active-OpeningsStickySection-Astro+own-Ashby-role-binding+full-native-criteria-and-country-proof',
  parser: 'current-company-and-native-ats',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedInventoryStatus: 'discovery-only',
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    'Current Sentry corporate careers publishes its active OpeningsStickySection Astro model with employer-bound Ashby application links and full visible job criteria. Runtime reconciles all corporate and native posting identities, countries, full descriptions and publishedAt dates, then verifies closing native and corporate inventories before caps. Missing role-owned native countries remain unresolved; neither a city nor employer headquarters authorizes a verified India zero or source cleanup.',
}

export default SENTRY_CATALOG
