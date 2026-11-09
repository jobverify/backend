import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ZIFO_RND_SOLUTIONS_CATALOG = {
  source: 'zifo',
  companyName: 'Zifo RnD Solutions',
  officialBrandName: 'Zifo',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'zifo/jobs.json',
  companyCareerPage: 'https://careers.zifo.com/',
  officialCareersPageUrl: 'https://careers.zifo.com/',
  companyDomain: 'careers.zifo.com',
  atsPlatform: 'workable',
  countryFilter: 'India',
  paginationStrategy: 'first-party-india-links-plus-complete-workable-published-jobs-feed',
  extractionStrategy: 'verified-first-party-india-links+workable-public-api+explicit-india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://careers.zifo.com/ links two Zifo India roles to Workable. The documented public Workable API at https://www.workable.com/api/accounts/zifo?details=true lists 41 published location records and the same two India roles. An outdated popup still says no vacancies; the scraper uses the matching first-party links and published feed.',
}

export default ZIFO_RND_SOLUTIONS_CATALOG
