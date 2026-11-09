import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const REDSEER_CATALOG = {
  source: 'redseer',
  companyName: 'Redseer',
  officialBrandName: 'RedSeer',
  adapter: 'script',
  homepageUrl: 'https://redseer.com/',
  companyCareerPage: 'https://redseer.com/careers/',
  publicJobsArchiveUrl: 'https://redseer.com/jobopenings/',
  emptyJobsFeedUrl: 'https://redseer.com/jobopenings/feed/',
  emptyJobsApiUrl: 'https://redseer.com/wp-json/wp/v2/jobopenings?per_page=100',
  companyDomain: 'redseer.com',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-empty-job-archive-validation',
  extractionStrategy:
    'verified-careers-page+verified-empty-job-archive+verified-empty-job-feed+verified-empty-job-rest-endpoint-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://redseer.com/careers/ is the official first-party RedSeer careers page and that it points candidates to a first-party public jobs surface at https://redseer.com/jobopenings/. Verified the current empty-board state by checking that the archive rendered no current public job listings, the public RSS feed at https://redseer.com/jobopenings/feed/ exposed no <item> entries, and the public WordPress REST endpoint at https://redseer.com/wp-json/wp/v2/jobopenings?per_page=100 returned an empty array. Redseer therefore has no current public job listings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'redseer/jobs.json',
}

export default REDSEER_CATALOG
