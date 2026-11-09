import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INSTABASE_CATALOG = {
  source: 'instabase',
  companyName: 'Instabase',
  officialBrandName: 'Instabase',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.instabase.com/careers/jobs',
  officialCareersLandingUrl: 'https://www.instabase.com/careers',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/instabase/jobs',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/instabase',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy: 'verified-first-party-careers-pages+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'instabase.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.instabase.com/careers is the live first-party Instabase careers landing page, that https://www.instabase.com/careers/jobs is the live first-party jobs page handing applicants to the official Instabase Greenhouse board, and that verified public board detail URLs include the Bengaluru, India posting at https://job-boards.greenhouse.io/instabase/jobs/8560504002. This scraper consumes the standard Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/instabase/jobs?content=true for structured extraction.',
  dryRunFile: 'instabase/jobs.json',
}

export default INSTABASE_CATALOG
