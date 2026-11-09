import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHUTTERFLY_INDIA_CATALOG = {
  source: 'shutterflyindia',
  companyName: 'Shutterfly India',
  officialBrandName: 'Shutterfly',
  adapter: 'script',
  homepageUrl: 'https://shutterflyinc.com/overview/',
  companyCareerPage: 'https://jobs.jobvite.com/shutterfly',
  officialJobsPageUrl: 'https://shutterflycareers.ttcportals.com/?p=jobs&nl=1',
  officialSearchResultsUrl: 'https://shutterflycareers.ttcportals.com/search/jobs',
  companyDomain: 'shutterflyinc.com',
  atsPlatform: 'jobvite-ttcportals-bot-gated-no-india-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'official-overview-plus-bot-gated-ttc-job-surfaces',
  extractionStrategy:
    'verified-overview-careers-link+verified-cloudflare-challenged-jobvite-entry+verified-cloudflare-challenged-search-results+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that https://shutterflyinc.com/overview/ remained the official Shutterfly corporate overview page and still handed candidates to https://jobs.jobvite.com/shutterfly, but direct fetches to both the redirected TTC careers entry at https://shutterflycareers.ttcportals.com/?p=jobs&nl=1 and the TTC search results page at https://shutterflycareers.ttcportals.com/search/jobs returned Cloudflare 403 challenge pages titled Just a moment.... No trustworthy bot-accessible public India jobs surface was exposed for the exact-name Shutterfly India target.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'shutterflyindia/jobs.json',
}

export default SHUTTERFLY_INDIA_CATALOG
