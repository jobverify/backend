import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GOODWORKER_CATALOG = {
  source: 'goodworker',
  companyName: 'GoodWorker',
  officialBrandName: 'GoodWorker',
  adapter: 'script',
  homepageUrl: 'https://goodworker.in/',
  companyCareerPage: 'https://goodworker.in/careers',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-exact-name-first-party-timeout-routes-skip',
  extractionStrategy:
    'verified-exact-name-first-party-routes-timeout-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'goodworker.in',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that direct first-party probes to https://goodworker.in/ and https://goodworker.in/careers timed out instead of exposing a trustworthy public GoodWorker jobs surface, so there was no trustworthy public jobs surface and no exact-name first-party careers contract could be verified.',
  firstPartyTimeoutUrls: [
    'https://goodworker.in/',
    'https://goodworker.in/careers',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default GOODWORKER_CATALOG
