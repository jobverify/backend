import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KEYCDN_CATALOG = {
  source: 'keycdn',
  companyName: 'KeyCDN',
  officialBrandName: 'KeyCDN',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'keycdn/jobs.json',
  companyCareerPage: 'https://www.keycdn.com/careers',
  companyDomain: 'keycdn.com',
  atsPlatform: 'official-company-site-no-public-jobs',
  countryFilter: 'Global',
  paginationStrategy: 'single-first-party-careers-page-no-public-openings',
  extractionStrategy: 'verified-first-party-careers-page+no-public-openings-or-ats-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.keycdn.com/careers was the live first-party KeyCDN careers page, that it still presented recruitment and culture copy including "Remote first company" and "Made in Switzerland", and that it exposed no trustworthy public jobs surface, ATS handoff, public openings list, or JobPosting records on the verified date.',
}

export default KEYCDN_CATALOG
