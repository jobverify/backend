import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PAGERDUTY_CATALOG = {
  source: 'pagerduty',
  companyName: 'PagerDuty',
  officialBrandName: 'PagerDuty',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pagerduty/jobs.json',
  companyCareerPage: 'https://careers.pagerduty.com/jobs/search',
  companyDomain: 'careers.pagerduty.com',
  atsPlatform: 'official-first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-open-roles-page-current-empty-india-slice',
  extractionStrategy:
    'verified-first-party-open-roles-page+inline-role-table+return-empty-when-no-india-locations',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://careers.pagerduty.com/jobs/search was the live first-party PagerDuty open roles page, that it publicly exposed 18 role rows directly on the first-party search surface, and that the visible role locations covered Singapore, London, Toronto, Santiago, Atlanta, Los Angeles, New York, San Francisco, Washington, and broader United States listings with zero India locations.',
}

export default PAGERDUTY_CATALOG
