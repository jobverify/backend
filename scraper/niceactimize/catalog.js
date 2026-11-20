import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NICE_ACTIMIZE_CATALOG = {
  source: 'niceactimize',
  companyName: 'NICE Actimize',
  officialBrandName: 'NICE Actimize',
  adapter: 'script',
  officialActimizePageUrl: 'https://www.niceactimize.com/get-in-touch',
  companyCareerPage: 'https://www.niceactimize.com/get-in-touch',
  registeredParentCareersLead: 'https://www.nice.com/careers/apply?location=India+-+Pune',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true',
  greenhouseBoardHost: 'boards.eu.greenhouse.io',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'paired-own-and-delegated-parent-observations;exact-native-unit-scope-held',
  extractionStrategy:
    'bounded-original-Responses+current-Actimize-to-NICE-delegation+complete-original-parent-feed+exact-native-employer-unit-observations;no-parent-product-keyword-promotion',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'niceactimize.com',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 120000,
  verifiedOn: null,
  verifiedJobCount: null,
  verifiedIndiaJobCount: null,
  sampleJobUrl: null,
  verifiedSurfaceSummary:
    'Current first-party https://www.niceactimize.com/get-in-touch delegates to broad NICE careers. Complete original records from the registered parent feed https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true are retained with exact native employer-unit evidence. Parent roles, title/product-skill keywords and contact domains never establish Actimize membership; unresolved unit scope is a coverage gap, not an India/company-zero claim.',
  dryRunFile: 'niceactimize/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NICE_ACTIMIZE_CATALOG
