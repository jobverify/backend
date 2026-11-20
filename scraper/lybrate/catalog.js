import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LYBRATE_CATALOG = {
  source: 'lybrate',
  companyName: 'Lybrate',
  officialBrandName: 'Lybrate',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'lybrate/jobs.json',
  homepageUrl: 'https://www.lybrate.com/',
  jobsPageUrl: 'https://www.lybrate.com/jobs',
  aboutPageUrl: 'https://www.lybrate.com/about',
  embeddedJobsApiUrl: 'https://api.lever.co/v0/postings/lybrate?group=team&mode=json',
  companyDomain: 'lybrate.com',
  atsPlatform: 'official-jobs-page-with-dead-embedded-api',
  countryFilter: 'India',
  paginationStrategy: 'stale-first-party-jobs-shell-validation',
  extractionStrategy: 'current-own-careers+literal-public-endpoint+bounded-opening-closing+unavailable-inventory-hold',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedPublicPostingCount: null,
  verifiedSurfaceSummary:
    'The current own about/jobs declaration and literal public Lever endpoint are acquired on both boundaries. A retired or unavailable native endpoint establishes a coverage gap, with unknown company totals and lifecycle cleanup held. Medical content and partner-company enrollment are not Lybrate employment vacancies.',
}

export default LYBRATE_CATALOG
