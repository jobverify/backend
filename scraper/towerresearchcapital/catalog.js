import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TOWER_RESEARCH_CAPITAL_CATALOG = {
  source: 'towerresearchcapital',
  companyName: 'Tower Research Capital',
  officialBrandName: 'Tower Research Capital',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.resolve(currentDir, 'jobs.json'),
  officialHomepageUrl: 'https://tower-research.com/',
  officialCareersLandingUrl: 'https://tower-research.com/careers/',
  companyCareerPage: 'https://tower-research.com/roles/',
  jobDetailsBaseUrl: 'https://www.tower-research.com/open-positions/',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/towerresearchcapital/jobs',
  greenhouseBoardEmbedUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=towerresearchcapital',
  companyDomain: 'tower-research.com',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-detail-url+primary-or-multi-location-india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-06',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 6, 2026 that https://tower-research.com/careers/ is the live first-party Tower Research Capital careers landing page, that https://tower-research.com/roles/ is the live first-party roles page embedding https://boards.greenhouse.io/embed/job_board/js?for=towerresearchcapital, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/towerresearchcapital/jobs?content=true returned 74 jobs including AI Operations Manager with a first-party detail URL on https://www.tower-research.com/open-positions/. This provider is pinned to those verified first-party careers pages plus the public Greenhouse API and only keeps India-primary roles or multi-location roles that explicitly include an India office.',
}

export default TOWER_RESEARCH_CAPITAL_CATALOG
