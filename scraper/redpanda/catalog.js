import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const REDPANDA_CATALOG = {
  source: 'redpanda',
  companyName: 'Redpanda',
  officialBrandName: 'Redpanda',
  adapter: 'script',
  companyCareerPage: 'https://www.redpanda.com/jobs',
  ashbyBoardSlug: 'redpanda-data',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/redpanda-data',
  companyDomain: 'redpanda.com',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-page-with-embedded-ashby-feed',
  extractionStrategy:
    'verified-first-party-jobs-page+embedded-ashby-job-board-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.redpanda.com/jobs was the live first-party Redpanda jobs page with canonical https://www.redpanda.com/jobs and a public Current job openings shell, that the page embedded ASHBY_BOARD = "redpanda-data" and fetched the public Ashby GET feed at https://api.ashbyhq.com/posting-api/job-board/redpanda-data, and that live verification of that embedded feed returned 15 listed roles with location buckets Poland, United Kingdom, United States, and USA but zero India openings on the verified date.',
  dryRunFile: 'redpanda/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default REDPANDA_CATALOG
