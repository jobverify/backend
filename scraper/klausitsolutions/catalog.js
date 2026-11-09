import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KLAUS_IT_SOLUTIONS_CATALOG = {
  source: 'klausitsolutions',
  companyName: 'Klaus IT Solutions',
  officialBrandName: 'Klaus IT Solutions',
  adapter: 'script',
  homepageUrl: 'https://klausit.com/',
  companyCareerPage: 'https://klausit.com/careers/',
  officialCareersPageUrl: 'https://klausit.com/careers/',
  companyDomain: 'klausit.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-careers-shell+myapipage-search-controls-without-public-role-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://klausit.com/careers/ exposed a first-party Klaus IT Solutions careers shell with MyApiPage assets and txtsearch/txtcity search controls, but no trustworthy public jobs surface with visible role rows or stable machine-readable listings was recovered from the verified crawl.',
  dryRunFile: 'klausitsolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default KLAUS_IT_SOLUTIONS_CATALOG
