import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NK_SECURITIES_CATALOG = {
  source: 'nksecurities',
  companyName: 'NK Securities',
  officialBrandName: 'NK Securities Research',
  adapter: 'script',
  homepageUrl: 'https://www.nksecurities.com/',
  companyCareerPage: 'https://www.nksecurities.com/open-positions.html',
  companyDomain: 'nksecurities.com',
  greenhouseJobsApiUrl: 'https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs',
  greenhouseBoardUrl: 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'official-open-positions-page-plus-greenhouse-api',
  extractionStrategy:
    'verified-homepage+verified-open-positions-page+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.nksecurities.com/open-positions.html is the official first-party NK Securities Research public jobs page, that it loads postings from https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs, and that the public Greenhouse payload at https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs?content=true exposed 17 public postings including India roles on that date.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'nksecurities/jobs.json',
}

export default NK_SECURITIES_CATALOG
