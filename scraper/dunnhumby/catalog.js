import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DUNNHUMBY_CATALOG = {
  source: 'dunnhumby',
  companyName: 'Dunnhumby',
  officialBrandName: 'dunnhumby',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  officialHomepageUrl: 'https://www.dunnhumby.com/',
  officialCareersLandingUrl: 'https://www.dunnhumby.com/careers/',
  officialWorkWithUsUrl: 'https://www.dunnhumby.com/work-with-us/',
  companyCareerPage: 'https://job-boards.greenhouse.io/dunnhumby',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/dunnhumby',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-pages+greenhouse-jobs-api+greenhouse-board-detail-url+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dunnhumby.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.dunnhumby.com/careers/ and https://www.dunnhumby.com/work-with-us/ are live first-party dunnhumby careers pages that hand off to the public Greenhouse board at https://job-boards.greenhouse.io/dunnhumby, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs?content=true currently exposes India roles including AI Engineering Manager - Global Infra and Applied Data Scientist in Gurgaon.',
  dryRunFile: 'dunnhumby/jobs.json',
}

export default DUNNHUMBY_CATALOG
