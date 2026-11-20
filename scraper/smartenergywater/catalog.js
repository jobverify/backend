import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMART_ENERGY_WATER_CATALOG = {
  source: 'smartenergywater',
  companyName: 'Smart Energy Water',
  officialBrandName: 'SEW.AI',
  adapter: 'script',
  homepageUrl: 'https://www.sew.ai/',
  companyCareerPage: 'https://www.sew.ai/sew-career',
  knownIndiaJobDetailUrl: 'https://www.sew.ai/careers/product-engineer-net',
  companyDomain: 'sew.ai',
  atsPlatform: 'first-party-current-SSR-openings-native-role-application-form',
  countryFilter: 'India',
  paginationStrategy: 'bounded-current-own-native-roster-and-every-literal-role-opening-closing-observation',
  extractionStrategy:
    'current-own-careers-declaration+native-SSR-vacancy-roster+same-canonical-role-title-country-and-native-form+valid-partials',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 180000,
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedGlobalJobCount: null,
  verifiedIndiaJobCount: null,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    'Current own SEW.AI careers declaration leads to its native Current Openings roster. Each original public role URL, actual title, whole explicit India workplace, publication constraints and same-canonical native application form qualify in opening and closing observations. Native CMS form identifiers are retained without inventing a job requisition. Valid partial criteria/dates are preserved; legal employer, full company inventory, application controls/backend and cleanup remain unverified.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SMART_ENERGY_WATER_CATALOG
