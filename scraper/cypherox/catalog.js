import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CYPHEROX_CATALOG = {
  source: 'cypherox',
  companyName: 'Cypherox Technologies',
  officialBrandName: 'Cypherox Technologies Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://www.cypherox.com/career',
  companyDomain: 'cypherox.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-careers-page+embedded-jobposting-graph',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.cypherox.com/career is the live first-party Cypherox Technologies careers page and that the page embeds structured JobPosting records for current opportunities including WordPress Developer and Business Development Executive on the same first-party surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cypherox/jobs.json',
}

export default CYPHEROX_CATALOG
