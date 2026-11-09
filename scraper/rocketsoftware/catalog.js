import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ROCKET_SOFTWARE_CATALOG = {
  source: 'rocketsoftware',
  companyName: 'Rocket Software',
  officialBrandName: 'Rocket Software',
  adapter: 'script',
  homepageUrl: 'https://www.rocketsoftware.com/',
  companyCareerPage: 'https://www.rocketsoftware.com/en-us/careers',
  workdayBoardUrl: 'https://rocket.wd5.myworkdayjobs.com/rocket_careers',
  jobsApiUrl: 'https://rocket.wd5.myworkdayjobs.com/wday/cxs/rocket/rocket_careers/jobs',
  companyDomain: 'rocketsoftware.com',
  atsPlatform: 'official-careers-workday-handoff',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-public-workday-jobs-api',
  extractionStrategy:
    'verified-careers-page-or-known-cloudflare-gate+public-workday-jobs-api+india-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.rocketsoftware.com/en-us/careers is still Rocket Software\'s live first-party careers page and still hands off View current openings to https://rocket.wd5.myworkdayjobs.com/rocket_careers. Direct non-browser fetches of the careers page now hit a Cloudflare challenge, so this scraper tolerates that known gate and uses the public Workday jobs API at https://rocket.wd5.myworkdayjobs.com/wday/cxs/rocket/rocket_careers/jobs, which returned 2 India postings: Software Engineer III and Senior Accounts Receivable Specialist, both in Pune, India.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'rocketsoftware/jobs.json',
}

export default ROCKET_SOFTWARE_CATALOG
