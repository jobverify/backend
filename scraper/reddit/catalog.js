import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const REDDIT_CATALOG = {
  source: 'reddit',
  companyName: 'Reddit',
  officialBrandName: 'Reddit',
  adapter: 'script',
  companyCareerPage: 'https://redditinc.com/careers',
  officialCareersPageUrl: 'https://redditinc.com/careers',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/reddit',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/reddit/jobs?content=true',
  companyDomain: 'redditinc.com',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-greenhouse-links+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://redditinc.com/careers is the live first-party Reddit careers page, that it still exposes embedded Greenhouse job links under https://job-boards.greenhouse.io/reddit/jobs/ plus inline location mapping entries for "Remote - India" and "Bangalore, India", and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/reddit/jobs?content=true was live with 195 current jobs but zero India roles at verification time.',
  dryRunFile: 'reddit/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default REDDIT_CATALOG
