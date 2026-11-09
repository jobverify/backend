import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APTOS_INDIA_CATALOG = {
  source: 'aptosindia',
  companyName: 'Aptos India',
  officialBrandName: 'Aptos',
  adapter: 'script',
  companyCareerPage: 'https://www.aptos.com/careers',
  companyDomain: 'aptos.com',
  officialHomepageUrl: 'https://www.aptos.com/',
  officialWorkdayBoardUrl: 'https://aptos.wd108.myworkdayjobs.com/Aptos',
  jobsApiUrl: 'https://aptos.wd108.myworkdayjobs.com/wday/cxs/aptos/Aptos/jobs',
  verifiedIndiaLocationName: 'IN Bangalore Office',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-locations-facet',
  extractionStrategy:
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+india-location-facet+filtered-workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.aptos.com/careers is the live first-party Aptos careers page and links View Jobs to the public Workday board at https://aptos.wd108.myworkdayjobs.com/Aptos. The public Workday jobs API at https://aptos.wd108.myworkdayjobs.com/wday/cxs/aptos/Aptos/jobs exposes a stable locations facet that currently includes IN Bangalore Office and returns 3 India roles when filtered to that verified India location.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default APTOS_INDIA_CATALOG
