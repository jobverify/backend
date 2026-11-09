import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RIPPLING_CATALOG = {
  source: 'rippling',
  companyName: 'Rippling',
  officialBrandName: 'Rippling',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.rippling.com/',
  companyCareerPage: 'https://www.rippling.com/careers',
  officialCareersLandingUrl: 'https://www.rippling.com/careers',
  openRolesUrl: 'https://www.rippling.com/careers/open-roles',
  algoliaSearchUrl: 'https://6FNAX3TBEF-dsn.algolia.net/1/indexes/careers_en-US_production/query',
  algoliaApplicationId: '6FNAX3TBEF',
  algoliaApiKey: '416caa4690f002ff6fe4a2097623640b',
  algoliaIndexName: 'careers_en-US_production',
  atsPlatform: 'algolia',
  countryFilter: 'India',
  paginationStrategy: 'algolia-direct-index-query-paged',
  extractionStrategy:
    'verified-first-party-careers-page+verified-open-roles-next-data+algolia-index+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'rippling.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.rippling.com/careers is the live first-party Rippling careers landing page linking to https://www.rippling.com/careers/open-roles, that the official open-roles page exposes __NEXT_DATA__ with Algolia index careers_en-US_production, and that the live first-party-backed Algolia index at https://6FNAX3TBEF-dsn.algolia.net/1/indexes/careers_en-US_production/query returned current India roles including SDR Manager, Outbound (India), Senior Software Engineer (HRIS), and Mid Market Account Executive - India in Bangalore, India.',
  dryRunFile: 'rippling/jobs.json',
}

export default RIPPLING_CATALOG
