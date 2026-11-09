import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROPHECY_CATALOG = {
  source: 'prophecy',
  companyName: 'Prophecy',
  officialBrandName: 'Prophecy',
  adapter: 'script',
  homepageUrl: 'https://www.prophecy.ai/',
  companyCareerPage: 'https://www.prophecy.ai/careers',
  companyDomain: 'prophecy.ai',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-greenhouse-departments-api',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-greenhouse-departments-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  greenhouseDepartmentsApiUrl:
    'https://boards-api.greenhouse.io/v1/boards/prophecysimpledatalabs/departments',
  greenhouseJobBoardPrefix: 'https://job-boards.greenhouse.io/prophecysimpledatalabs/jobs/',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.prophecy.ai/careers is the live official Prophecy careers page, that it exposes the first-party OPEN POSITIONS surface plus an embedded Greenhouse departments API at https://boards-api.greenhouse.io/v1/boards/prophecysimpledatalabs/departments, and that the live public payload currently includes the India role Senior DevOps Engineer in Bengaluru.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default PROPHECY_CATALOG
