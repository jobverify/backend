import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOBILOITTE_TECHNOLOGIES_CATALOG = {
  source: 'mobiloittetechnologies',
  companyName: 'Mobiloitte Technologies',
  officialBrandName: 'Mobiloitte',
  adapter: 'script',
  homepageUrl: 'https://www.mobiloitte.com/',
  companyCareerPage: 'https://www.mobiloitte.com/careers',
  companyDomain: 'mobiloitte.com',
  atsPlatform: 'first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-visible-cards',
  extractionStrategy:
    'verified-first-party-role-cards+canonical-role-details+empty-state-fallback',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the official Mobiloitte careers page displays four Delhi job cards with role-specific canonical detail pages. The visible cards are collected and marked listing-incomplete because the page does not advertise a total count.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mobiloittetechnologies/jobs.json',
}

export default MOBILOITTE_TECHNOLOGIES_CATALOG
