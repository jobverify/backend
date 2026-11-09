import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GREYTHR_CATALOG = {
  source: 'greythr',
  companyName: 'Greytip Software',
  officialBrandName: 'greytHR',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.greythr.com/company/careers/',
  companyDomain: 'greythr.com',
  atsPlatform: 'greytip-greythr-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-greytip-published-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+greytip-public-published-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedPublicPostingCount: 10,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.greythr.com/company/careers/ is Greytip Software\'s live first-party careers page and links to https://greytip.greythr.com/hire/jobs/. The linked portal loads a public Greytip jobs application whose first-party published-jobs endpoint https://greytip.greythr.com/hire/api/career/published_jobs/ returned HTTP 200 with current records, including a July 22, 2026 posting. The provider uses that public JSON listing as its source of truth.',
}

export default GREYTHR_CATALOG
