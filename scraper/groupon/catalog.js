import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GROUPON_CATALOG = {
  source: 'groupon',
  companyName: 'Groupon',
  officialBrandName: 'Groupon',
  adapter: 'script',
  companyCareerPage: 'https://www.grouponcareers.com/',
  officialCareersLandingUrl: 'https://www.grouponcareers.com/',
  officialJobsBoardUrl: 'https://job-boards.eu.greenhouse.io/groupon',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/groupon/jobs',
  greenhouseJobBaseUrl: 'https://job-boards.eu.greenhouse.io/groupon/jobs',
  sampleJobUrl: 'https://job-boards.eu.greenhouse.io/groupon/jobs/4970408101',
  companyDomain: 'grouponcareers.com',
  atsPlatform: 'greenhouse',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-shell+greenhouse-board-backlink+visible-greenhouse-board-jobs+greenhouse-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedJobCount: 23,
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://www.grouponcareers.com/ redirects to the new first-party app at https://careers.groupon.com/. The official Greenhouse board at https://job-boards.eu.greenhouse.io/groupon links back to the Groupon careers domain and exposes 23 public jobs. Its API at https://boards-api.greenhouse.io/v1/boards/groupon/jobs?content=true returns the same 23 jobs, including four Bangalore roles with official Greenhouse detail URLs.',
  dryRunFile: 'groupon/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GROUPON_CATALOG
