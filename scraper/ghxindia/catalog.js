import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GHX_INDIA_CATALOG = {
  source: 'ghxindia',
  companyName: 'GHX India',
  officialBrandName: 'GHX',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.ghx.com/about/careers/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/globalhealthcareexchangeinc',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/globalhealthcareexchangeinc/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+greenhouse-jobs-api+greenhouse-public-detail-urls+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ghx.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.ghx.com/about/careers/ is the live GHX careers page with a View all positions handoff to https://job-boards.greenhouse.io/globalhealthcareexchangeinc, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/globalhealthcareexchangeinc/jobs?content=true currently exposes India roles including Software Engineer II and Senior Software Engineer in Hyderabad, Telangana, India.',
  dryRunFile: 'ghxindia/jobs.json',
}

export default GHX_INDIA_CATALOG
