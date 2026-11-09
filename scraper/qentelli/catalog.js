import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const QENTELLI_CATALOG = {
  source: 'qentelli',
  companyName: 'Qentelli',
  officialBrandName: 'Qentelli',
  adapter: 'script',
  homepageUrl: 'https://www.qentelli.com/',
  companyCareerPage: 'https://www.qentelli.com/careers',
  blockedJobsPageUrl: 'https://www.qentelli.com/jobs',
  atsPlatform: 'first-party-403-blocked-no-trustworthy-public-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'blocked-surface',
  extractionStrategy: 'verified-first-party-403-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'qentelli.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the first-party Qentelli homepage, careers route, and jobs route returned 403 responses to direct public scraper requests, so there was no trustworthy bot-accessible public jobs surface to enumerate.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default QENTELLI_CATALOG
