import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LOGROCKET_CATALOG = {
  source: 'logrocket',
  companyName: 'LogRocket',
  officialBrandName: 'LogRocket',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'logrocket/jobs.json',
  companyCareerPage: 'https://logrocket.com/careers',
  companyDomain: 'logrocket.com',
  atsPlatform: 'official-first-party-nextjs-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-next-data-openings-page-current-empty-india-slice',
  extractionStrategy:
    'verified-first-party-next-data-openings+return-empty-when-no-india-locations',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://logrocket.com/careers was the live first-party LogRocket careers page, that its serialized __NEXT_DATA__ openings payload exposed 6 public openings, and that the visible role locations were Boston or NYC, Boston, MA, and Remote - US or Boston, MA with zero India locations.',
}

export default LOGROCKET_CATALOG
