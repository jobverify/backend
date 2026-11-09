import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 19, 2026 that https://www.tenonhq.com/join-us is the live first-party Tenon join-us page and links See Open Positions to the public Greenhouse board at https://job-boards.greenhouse.io/tenon. Verified that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/tenon/jobs returned 1 live role, Associate ServiceNow Technical Consultant in Indianapolis, IN, so no India jobs were verified on the trusted public surface.'

export const TENON_CATALOG = {
  source: 'tenon',
  companyName: 'Tenon',
  officialBrandName: 'Tenon',
  adapter: 'script',
  companyCareerPage: 'https://www.tenonhq.com/join-us',
  officialCareersPageUrl: 'https://www.tenonhq.com/join-us',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/tenon',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/tenon/jobs',
  companyDomain: 'tenonhq.com',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-greenhouse-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+current-greenhouse-board+greenhouse-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'tenon/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TENON_CATALOG
