import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AGILOFT_INDIA_CATALOG = {
  source: 'agiloftindia',
  companyName: 'Agiloft India',
  officialBrandName: 'Agiloft',
  adapter: 'script',
  companyCareerPage: 'https://www.agiloft.com/careers/',
  companyDomain: 'agiloft.com',
  officialCareersAliasUrl: 'https://www.agiloft.com/about-us/careers/',
  officialLeverBoardUrl: 'https://jobs.lever.co/agiloft',
  leverApiUrl: 'https://api.lever.co/v0/postings/agiloft?mode=json',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'corporate-advertised-full-feed-board-details-and-closing-reconciliation',
  extractionStrategy:
    'runtime-corporate-handoff+full-native-inventory+all-visible-details+primary-secondary-countries+closing-membership+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-27',
  verifiedSurfaceSummary:
    'The corporate careers page https://www.agiloft.com/careers/ advertises https://api.lever.co/v0/postings/agiloft?mode=json in its native inline careers code and renders public hostedUrl links on https://jobs.lever.co/agiloft. Every run must re-prove this handoff, reconcile the full native board/feed, validate all visible descriptions and primary/secondary work countries, and recheck closing details and membership before filtering India. Catalog notes are not live inventory evidence.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AGILOFT_INDIA_CATALOG
