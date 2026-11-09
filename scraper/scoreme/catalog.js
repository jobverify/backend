import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCOREME_CATALOG = {
  source: 'scoreme',
  companyName: 'ScoreMe Solutions',
  officialBrandName: 'ScoreMe Solutions',
  adapter: 'script',
  homepageUrl: 'https://scoreme.in/',
  companyCareerPage: 'https://scoreme.in/jobs/',
  companyDomain: 'scoreme.in',
  atsPlatform: 'official-first-party-jobs-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'same-domain-job-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://scoreme.in/jobs/ was the live first-party ScoreMe Solutions jobs page, that it publicly presented the Job Openings listing, and that it listed current openings including Data Pipeline Developer and Digital Marketing Associate in Gurgaon on the verified date.',
  dryRunFile: 'scoreme/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SCOREME_CATALOG
