import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AVIZVA_CATALOG = {
  source: 'avizva',
  companyName: 'AVIZVA',
  officialBrandName: 'AVIZVA',
  adapter: 'script',
  homepageUrl: 'https://www.avizva.com/',
  companyCareerPage: 'https://www.avizva.com/career',
  careersVendorHost: 'avizva.keka.com',
  companyDomain: 'avizva.com',
  atsPlatform: 'keka',
  countryFilter: 'India',
  paginationStrategy: 'current-native-complete-active-array-plus-opening-and-closing-full-details',
  extractionStrategy:
    'current-active-corporate-handoffs+literal-native-tenant+reviewed-read-only-client+typed-countries+full-native-criteria+closing-reconciliation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-05',
  verifiedSurfaceSummary:
    'Verified November 5, 2026 using public GETs with JavaScript disabled: the live https://www.avizva.com/career title changed, and four corporate Keka cards reconcile to three active native postings plus explicitly closed 157359. The declared avizva.keka.com tenant, literal configuration, current renderer and active array expose full authored descriptions, explicit IN/India and US/United States countries, and opening/closing matching role details. Complete inventory describes only the configured public board; company-wide totals remain unknown. Historical August cards (Senior Engineer, Visual Product Design, Senior Python Engineer, Python Engineer) remain parser fixtures and cannot publish fabricated summaries.',
  sourceScope: 'configured-public-board',
  companyGlobalTotal: null,
  companyIndiaTotal: null,
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'avizva/jobs.json',
}

export default AVIZVA_CATALOG
