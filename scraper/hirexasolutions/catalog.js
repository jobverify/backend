import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HIREXA_SOLUTIONS_CATALOG = {
  source: 'hirexasolutions',
  companyName: 'HIREXA SOLUTIONS',
  officialBrandName: 'Hirexa',
  adapter: 'script',
  homepageUrl: 'https://hirexa.com/',
  companyCareerPage: 'https://hirexa.com/careers/',
  companyDomain: 'hirexa.com',
  atsPlatform: 'official-careers-placeholder-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-validation',
  extractionStrategy:
    'verified-search-job-shell+repeated-placeholder-netcraft-cards+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://hirexa.com/careers/ is the live first-party Hirexa careers page, but the openings area still rendered placeholder NetCraft marquee cards alongside generic Search Job and Apply new sections without trustworthy role titles, locations, or detail URLs. Because the public surface is placeholder-only rather than a real openings feed, this provider remains fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'hirexasolutions/jobs.json',
}

export default HIREXA_SOLUTIONS_CATALOG
