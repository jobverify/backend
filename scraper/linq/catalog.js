import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://linq.co/en/ is the official first-party linq homepage and links candidates to the live public board at https://app.linq.co/en/job-board, that https://app.linq.co/en/company/1 is the official linq company page on that board, and that the first-party JSON search endpoint https://app.linq.co/b/api/job-board/search returned 14 public jobs for companyId=1 during verification. A conservative exact-name filter against the official detail payloads at https://app.linq.co/b/api/job-board/job/{id} left 6 exact-company jobs after excluding listings whose official headline or overview explicitly says they are on behalf of a client or partner.'

export const LINQ_CATALOG = {
  source: 'linq',
  companyName: 'Linq',
  officialBrandName: 'linq',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'linq/jobs.json',
  companyCareerPage: 'https://app.linq.co/en/company/1',
  companyDomain: 'linq.co',
  officialHomepageUrl: 'https://linq.co/en/',
  officialCompanyPageUrl: 'https://app.linq.co/en/company/1',
  officialJobBoardUrl: 'https://app.linq.co/en/job-board',
  apiBaseUrl: 'https://app.linq.co/b/api',
  jobSearchApiUrl: 'https://app.linq.co/b/api/job-board/search',
  jobDetailApiBaseUrl: 'https://app.linq.co/b/api/job-board/job',
  companyId: 1,
  verifiedPublicJobCount: 14,
  verifiedExactCompanyJobCount: 6,
  atsPlatform: 'linq-job-board',
  countryFilter: 'Global',
  paginationStrategy: 'official-company-filtered-search-api-pagination',
  extractionStrategy:
    'official-search-api+official-detail-api+exclude-client-and-partner-handoff-roles',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default LINQ_CATALOG
