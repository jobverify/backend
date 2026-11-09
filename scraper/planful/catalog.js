import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that both https://planful.com/jobs/ and https://planful.com/jobs/careers-list/ now render the live first-party "Open Roles at Planful | Planful Careers" shell, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/hostanalytics/jobs?content=true returned 12 public jobs with 0 India roles. A current public sample posting is Customer Success Advocate at https://planful.com/jobs/careers-list/?gh_jid=8644621002, so this provider continues to preserve first-party Planful detail URLs while returning 0 India jobs until India roles reappear.'

export const PLANFUL_CATALOG = {
  source: 'planful',
  companyName: 'Planful',
  officialBrandName: 'Planful',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'planful/jobs.json',
  companyCareerPage: 'https://planful.com/jobs/careers-list/',
  officialCareersLandingUrl: 'https://planful.com/jobs/',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/hostanalytics/jobs',
  verifiedPublicJobCount: 12,
  verifiedIndiaJobCount: 0,
  verifiedSampleJobTitle: 'Customer Success Advocate',
  verifiedSampleJobUrl: 'https://planful.com/jobs/careers-list/?gh_jid=8644621002',
  companyDomain: 'planful.com',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-detail-url-preservation+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default PLANFUL_CATALOG
