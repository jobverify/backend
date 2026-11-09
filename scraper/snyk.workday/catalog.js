import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SNYK_CATALOG = {
  source: 'snyk',
  companyName: 'Snyk',
  officialBrandName: 'Snyk',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'snyk.workday/jobs.json',
  officialCareersLandingUrl: 'https://snyk.io/careers/',
  companyCareerPage: 'https://snyk.io/careers/all-jobs/',
  ashbyBoardToken: '98cd1a00-2706-4aa8-ab72-38a7b8c9c20c',
  ashbyBoardUrl: 'https://jobs.ashbyhq.com/98cd1a00-2706-4aa8-ab72-38a7b8c9c20c',
  ashbyJobsApiUrl: 'https://api.ashbyhq.com/posting-api/job-board/98cd1a00-2706-4aa8-ab72-38a7b8c9c20c',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'single-ashby-board-api-page',
  extractionStrategy:
    'verified-first-party-careers-pages+linked-ashby-board-api+complete-inventory-zero-india-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'snyk.io',
  verifiedOn: '2026-10-03',
  verifiedPublicJobCount: 13,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that Snyk\'s official all-jobs page links to its Ashby board and enumerates the same 13 public roles as the Ashby posting API. The complete current inventory has zero India openings; every listed location is outside India.',
}

export default SNYK_CATALOG
