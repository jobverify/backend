import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.five9.com/about/careers is the live first-party Five9 careers landing page, that https://www.five9.com/about/careers/jobs is the live first-party jobs page, and that the jobs page loads the public Greenhouse embed script https://boards.greenhouse.io/embed/job_board/js?for=five9. Browser-side verification against the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/five9/jobs?content=true returned 156 public jobs and 52 India roles, including NOC Technician | India in Bengaluru and Technical Support Engineer in Chennai, with first-party detail routes such as https://www.five9.com/about/careers/job-detail?gh_jid=5985462004.'

export const FIVE9_INDIA_CATALOG = {
  source: 'five9india',
  companyName: 'Five9 India',
  officialBrandName: 'Five9',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'five9india/jobs.json',
  officialHomepageUrl: 'https://www.five9.com/',
  officialCareersLandingUrl: 'https://www.five9.com/about/careers',
  companyCareerPage: 'https://www.five9.com/about/careers/jobs',
  greenhouseEmbedScriptUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=five9',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/five9/jobs',
  verifiedSampleJobUrl: 'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
  verifiedPublicJobCount: 156,
  verifiedIndiaJobCount: 52,
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-gh_jid-detail-routes+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'five9.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FIVE9_INDIA_CATALOG
