import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ELTROPY_CATALOG = {
  source: 'eltropy',
  companyName: 'Eltropy',
  officialBrandName: 'Eltropy',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  officialHomepageUrl: 'https://eltropy.com/',
  officialCareersLandingUrl: 'https://eltropy.com/careers/',
  companyCareerPage: 'https://job-boards.greenhouse.io/eltropyinc',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/eltropyinc',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/eltropyinc/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page-or-blocked-official-surface+greenhouse-board+greenhouse-jobs-api+greenhouse-board-detail-url+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'eltropy.com',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://eltropy.com/ and https://eltropy.com/careers/ return the same Cloudflare 403 Forbidden page, while the public Greenhouse board at https://job-boards.greenhouse.io/eltropyinc and the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/eltropyinc/jobs?content=true remain live. The API lists 11 Eltropy Inc. roles, including five India roles such as Engineering Manager and Senior Backend Engineer, with matching public Greenhouse detail URLs.',
  dryRunFile: 'eltropy/jobs.json',
}

export default ELTROPY_CATALOG
