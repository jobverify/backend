import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DALOOPA_CATALOG = {
  source: 'daloopa',
  companyName: 'Daloopa',
  officialBrandName: 'Daloopa',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'daloopa/jobs.json',
  companyCareerPage: 'https://daloopa.com/careers',
  officialCareersPageUrl: 'https://daloopa.com/careers',
  companyDomain: 'daloopa.com',
  atsPlatform: 'official-company-careers-no-public-open-roles',
  countryFilter: 'India',
  paginationStrategy: 'verified-single-first-party-careers-page-without-public-role-cards',
  extractionStrategy: 'verified-first-party-careers-landing-page-without-public-open-roles',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://daloopa.com/careers is a live first-party Daloopa careers landing page with generic recruiting copy and Request a Demo / Create Free Account / Log In calls to action, but no public open role cards, no same-domain job detail links, and no trustworthy batch-safe public jobs contract.',
}

export default DALOOPA_CATALOG
