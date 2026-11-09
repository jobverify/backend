import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AGILISIUM_CATALOG = {
  source: 'agilisium',
  companyName: 'Agilisium',
  officialBrandName: 'Agilisium',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.agilisium.com/',
  companyCareerPage: 'https://www.agilisium.com/people-and-careers',
  jobsBoardUrl: 'https://agilisium.zohorecruit.com/jobs/Careers',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'native-board-api-full-array-and-closing-reconciliation',
  extractionStrategy: 'current-employer-handoff+exact-native-organization+full-record-descriptions',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'agilisium.com',
  dryRunFile: 'agilisium/jobs.json',
  verifiedOn: '2026-10-26',
  verifiedSurfaceSummary:
    'On October 26, 2026, the current official https://www.agilisium.com/people-and-careers page actively links https://agilisium.zohorecruit.com/jobs/Careers. Runtime validates the exact native organization/page, reconciles complete embedded/API inventories, fetches full native descriptions and application URLs, and preserves original public dates. Additional recruiting scope retains partial evidence.',
}

export default AGILISIUM_CATALOG
