import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOROCO_CATALOG = {
  source: 'soroco',
  companyName: 'Soroco',
  officialBrandName: 'Soroco',
  adapter: 'script',
  homepageUrl: 'https://soroco.com/',
  companyCareerPage: 'https://soroco.com/careers',
  allOpeningsUrl: 'https://soroco.com/all-job-openings',
  embeddedGreenhouseApiUrl: 'https://boards-api.greenhouse.io/v1/boards/soroco/jobs?content=true',
  companyDomain: 'soroco.com',
  atsPlatform: 'own-declared-zoho-public-widget',
  countryFilter: 'India',
  paginationStrategy: 'paired-current-native-collection-before-bounded-optional-own-role-pairs',
  extractionStrategy:
    'own-current-home-careers-srcdoc+connected-native-get-row-handoff+typed-country+known-partials-originals-and-dates',
  parser: 'custom-script',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 180000,
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSampleJobUrl: null,
  verifiedSurfaceSummary:
    'Current own first-party pages declare the Soroco Zoho native widget and public GET. Business data flow, each literal native country, employer, same-role public handoff and opening/closing core are qualified without executing programmes or pinning whole pages/builds. Known criteria and actual dates remain original partial evidence. Date_Opened is retained without asserting original posting semantics. Company totals, legal employing entity, CSS/iframe/UI/application activation, backend and lifecycle cleanup held. Legacy Greenhouse is unused.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SOROCO_CATALOG
