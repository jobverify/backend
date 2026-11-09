import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const YATRA_CATALOG = {
  source: 'yatra',
  companyName: 'Yatra',
  officialBrandName: 'Yatra',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'yatra/jobs.json',
  companyCareerPage: 'https://www.yatra.com/career/job-portal',
  companyDomain: 'yatra.com',
  atsPlatform: 'yatra-first-party-career-portal',
  countryFilter: 'India',
  paginationStrategy: 'single-browser-rendered-job-portal',
  extractionStrategy: 'verified-first-party-job-portal+browser-rendered-listings+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that Yatra\'s first-party careers surface at https://www.yatra.com/career/home links to the enumerable job portal at https://www.yatra.com/career/job-portal, which exposed current job openings and application instructions for jobs@yatra.com. The provider renders that official portal and filters its India locations.',
}

export default YATRA_CATALOG
