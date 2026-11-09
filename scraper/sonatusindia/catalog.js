import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SONATUS_INDIA_CATALOG = {
  source: 'sonatusindia',
  companyName: 'Sonatus India',
  officialBrandName: 'Sonatus',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.sonatus.com/company/careers/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/sonatus',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/sonatus/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+official-greenhouse-board+greenhouse-jobs-api+india-location-filter+talent-community-exclusion',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sonatus.com',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that the official Sonatus careers page at https://www.sonatus.com/company/careers/ still exposed a View open positions handoff to the official Greenhouse board at https://job-boards.greenhouse.io/sonatus, and that the same first-party careers page still listed India and New Delhi among Sonatus locations. Verified that the official Greenhouse board currently showed 25 jobs and that Pune, India now appears only inside the non-requisition Sonatus Talent Community prospect post, so this exact-name provider uses the verified Greenhouse public jobs API pattern for board token sonatus while filtering to India locations and excluding the Talent Community prospect post.',
  dryRunFile: 'sonatusindia/jobs.json',
}

export default SONATUS_INDIA_CATALOG
