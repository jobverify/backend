import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const JUMIO_CATALOG = {
  source: 'jumio',
  companyName: 'Jumio',
  officialBrandName: 'Jumio',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.jumio.com/careers/job-listings/',
  jobsApiUrl: 'https://www.jumio.com/wp-json/jobs/filter',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/jumio',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-api-response',
  extractionStrategy:
    'verified-first-party-job-listings-page+wp-json-jobs-filter+greenhouse-public-detail-urls+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'jumio.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that Jumio’s official openings page at https://www.jumio.com/careers/job-listings/ exposes a first-party jobs API at https://www.jumio.com/wp-json/jobs/filter and Greenhouse detail URLs on https://job-boards.greenhouse.io/jumio, with live India openings including DevOps Engineer IV (Obs), Principal iOS Engineer, SDE III - MLOps, and Machine Learning Engineer - IV (Biometrics).',
  dryRunFile: 'jumio/jobs.json',
}

export default JUMIO_CATALOG
