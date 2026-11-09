import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DUNNHUMBY_INDIA_CATALOG = {
  source: 'dunnhumbyindia',
  companyName: 'Dunnhumby India',
  officialBrandName: 'dunnhumby',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.dunnhumby.com/',
  companyCareerPage: 'https://www.dunnhumby.com/work-with-us/',
  officialCareersLandingUrl: 'https://www.dunnhumby.com/careers/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/dunnhumby',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-pages+verified-greenhouse-board+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dunnhumby.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.dunnhumby.com/careers/ is the live first-party careers landing page, that https://www.dunnhumby.com/work-with-us/ is the live first-party work-with-us page linking candidates to the trusted public Greenhouse board at https://job-boards.greenhouse.io/dunnhumby, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs?content=true currently exposes India openings including Senior Applied Data Scientist in New Gurgaon and Applied Data Scientist in Gurgaon.',
  dryRunFile: 'dunnhumbyindia/jobs.json',
}

export default DUNNHUMBY_INDIA_CATALOG
