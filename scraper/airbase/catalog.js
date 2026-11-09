import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AIRBASE_CATALOG = {
  source: 'airbase',
  companyName: 'Airbase',
  officialBrandName: 'Airbase by Paylocity',
  legalEntityName: null,
  adapter: 'script',
  companyCareerPage: 'https://www.airbase.com/careers',
  parentCareersPage: 'https://www.paylocity.com/company/careers/',
  companyDomain: 'airbase.com',
  atsPlatform: 'paylocity-public-native-parent-board',
  countryFilter: 'India',
  paginationStrategy: 'full-parent-native-board+own-India-details-and-application-questions+closing-before-caps',
  extractionStrategy:
    'current-corporate-parent-redirect+exact-native-tenant+own-employer-brand-and-country+complete-published-criteria',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'The current https://www.airbase.com/careers redirect identifies https://www.paylocity.com/company/careers/. Its native public parent tenant exposes typed India roles whose own complete public descriptions explicitly declare Airbase by Paylocity. Runtime retains all parent inventory, original PublishedDate, own role country and application screening questions, and compares closing inventory and criteria before caps. The parent board total is not an Airbase total. Broader company hiring channels and legal hiring employer remain unresolved; no India zero or lifecycle cleanup is authorized.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AIRBASE_CATALOG
