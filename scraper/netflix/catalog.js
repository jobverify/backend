import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NETFLIX_CATALOG = {
  source: 'netflix',
  companyName: 'Netflix',
  officialBrandName: 'Netflix',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://jobs.netflix.com/locations/mumbai?location=Mumbai%2C+India',
  exploreJobsBaseUrl: 'https://explore.jobs.netflix.net/careers',
  companyDomain: 'jobs.netflix.com',
  atsPlatform: 'official-first-party-location-page-plus-public-explore-board',
  countryFilter: 'India',
  paginationStrategy: 'single-public-location-handoff-page-with-embedded-position-state',
  extractionStrategy: 'verified-first-party-location-page+public-explore-positions-state+public-detail-pages+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://jobs.netflix.com/locations/mumbai?location=Mumbai%2C+India was the live first-party Netflix Mumbai careers page, that it handed applicants to the public explore board at https://explore.jobs.netflix.net/careers, and that the verified Mumbai handoff page exposed 5 Mumbai roles in its embedded public position state on the verified date.',
  dryRunFile: 'netflix/jobs.json',
}

export default NETFLIX_CATALOG
