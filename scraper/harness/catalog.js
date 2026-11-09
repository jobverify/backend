import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.harness.io/company/jobs is the live first-party Harness jobs page with the current Greenhouse shell, that https://www.harness.io/company/careers is the first-party careers page linking to https://boards.greenhouse.io/harnessinc, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/harnessinc/jobs?content=true currently returns 108 public postings and 31 India roles. Verified sample India role: Director of Quality Engineering & Automation in Bengaluru, Karnataka, India at https://www.harness.io/company/jobs/apply?gh_jid=5137484007.'

export const HARNESS_CATALOG = {
  source: 'harness',
  companyName: 'Harness',
  officialBrandName: 'Harness',
  adapter: 'script',
  dryRunFile: 'harness/jobs.json',
  companyCareerPage: 'https://www.harness.io/company/jobs',
  officialCareersPageUrl: 'https://www.harness.io/company/careers',
  greenhouseBoardUrl: 'https://boards.greenhouse.io/harnessinc',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/harnessinc/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-jobs-page+verified-first-party-careers-page+greenhouse-jobs-api+first-party-apply-url-canonicalization+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'harness.io',
  verifiedOn: '2026-07-16',
  verifiedPublicPostingCount: 108,
  verifiedIndiaRoleCount: 31,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HARNESS_CATALOG
