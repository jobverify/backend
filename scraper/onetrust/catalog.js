import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ONETRUST_CATALOG = {
  source: 'onetrust',
  companyName: 'One Trust',
  officialBrandName: 'OneTrust',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'onetrust/jobs.json',
  companyCareerPage: 'https://www.onetrust.com/careers/',
  companyDomain: 'onetrust.com',
  atsPlatform: 'first-party-greenhouse-job-lister',
  countryFilter: 'India',
  paginationStrategy: 'first-visible-greenhouse-lister-page',
  extractionStrategy:
    'verified-first-party-careers-page+visible-job-lister+detail-page-india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 82,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.onetrust.com/careers/ is the live first-party OneTrust careers page, that the page exposes a greenhousejoblister shell with visible role links under /careers/, and that the public list shows 82 roles. Verified visible role links including Principal Software Engineer - Java Backend and detail text showing Bengaluru, India | Engineering on the first-party detail page, so this scraper extracts visible listings and filters them to India.',
}

export default ONETRUST_CATALOG
