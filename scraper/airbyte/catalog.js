import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AIRBYTE_CATALOG = {
  source: 'airbyte',
  companyName: 'Airbyte',
  officialBrandName: 'Airbyte',
  adapter: 'script',
  companyCareerPage: 'https://airbyte.com/company/careers',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/airbyte',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/airbyte',
  companyDomain: 'airbyte.com',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'complete-native-board-feed-all-details-and-closing-reconciliation',
  extractionStrategy:
    'current-corporate-lazy-client-embed-binding+native-board-feed-all-role-details+explicit-worksite-countries+closing-role-state',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-27',
  verifiedSurfaceSummary:
    'Current first-party careers at https://airbyte.com/company/careers bind https://jobs.ashbyhq.com/airbyte through the advertised lazy careers module and native embed. Each run reconciles the full public board, https://api.ashbyhq.com/posting-api/job-board/airbyte feed, every native role detail, all primary and secondary countries, original publication and expiry, and closing corporate and native role state. Current completeness comes only from that run; historical zero India observations do not authorize cleanup.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AIRBYTE_CATALOG
