import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BUSINESSNEXT_CAREERS_HUB_URL = 'https://careers.businessnext.com/default/index'
export const BUSINESSNEXT_CAREERS_URL = 'https://careers.businessnext.com/default/current_openings'

export const BUSINESSNEXT_CATALOG = {
  source: 'businessnext',
  companyName: 'BUSINESSNEXT',
  officialBrandName: 'BUSINESSNEXT',
  adapter: 'script',
  homepageUrl: 'https://www.businessnext.com/',
  careersHubUrl: BUSINESSNEXT_CAREERS_HUB_URL,
  companyCareerPage: BUSINESSNEXT_CAREERS_URL,
  companyDomain: 'businessnext.com',
  atsPlatform: 'first-party-current-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-page',
  extractionStrategy: 'verified-first-party-careers-home+current-openings-category-tables',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.businessnext.com/default/index remained the first-party BUSINESSNEXT careers home and linked to https://careers.businessnext.com/default/current_openings, where the live current-openings table showed 19 open positions including Lead - DevOps, Manager- DataScience, and Assistant Manager - .Net Core. This local provider reads the first-party category tables directly and keeps only India-located roles.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'businessnext/jobs.json',
}

export default BUSINESSNEXT_CATALOG
