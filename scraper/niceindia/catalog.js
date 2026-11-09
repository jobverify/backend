import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.nice.com/careers/apply is the live first-party NiCE careers page, that the India-filtered official view at https://www.nice.com/careers/apply?location=India+-+Pune exposes public India postings and direct Greenhouse detail links under https://boards.eu.greenhouse.io/nice/jobs/, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true returned 327 live public jobs including 45 India jobs with sample India postings such as Cloud Operations Engineer at https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101.'

export const NICE_INDIA_CATALOG = {
  source: 'niceindia',
  companyName: 'NICE India',
  officialBrandName: 'NiCE',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'niceindia/jobs.json',
  homepageUrl: 'https://www.nice.com/',
  companyCareerPage: 'https://www.nice.com/careers/apply?location=India+-+Pune',
  officialCareersLandingUrl: 'https://www.nice.com/careers/apply',
  companyDomain: 'nice.com',
  greenhouseBoardUrl: 'https://boards.eu.greenhouse.io/nice',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/nice/jobs',
  verifiedPublicJobCount: 327,
  verifiedIndiaJobCount: 45,
  verifiedSampleJobUrl: 'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-greenhouse-job-links+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default NICE_INDIA_CATALOG
