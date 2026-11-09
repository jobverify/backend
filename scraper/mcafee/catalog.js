import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MCAFEE_CATALOG = {
  source: 'mcafee',
  companyName: 'McAfee',
  officialBrandName: 'McAfee',
  adapter: 'script',
  homepageUrl: 'https://careers.mcafee.com/join',
  companyCareerPage: 'https://careers.mcafee.com/join',
  jobsPageUrl: 'https://careers.mcafee.com/jobs',
  jobsApiUrl: 'https://careers.mcafee.com/api/jobs',
  searchResultsUrl: 'https://careers.mcafee.com/global/en/search-results',
  companyDomain: 'careers.mcafee.com',
  atsPlatform: 'jibe-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'join-page-plus-jobs-page-plus-jobs-api-country-filter',
  extractionStrategy:
    'verified-jibe-join-page+verified-jobs-page+verified-public-jobs-api-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedPublicJobCount: 5,
  verifiedSampleJobUrl: 'https://careers.mcafee.com/jobs/1469?lang=en-us',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://careers.mcafee.com/join is the live McAfee careers shell, that the public jobs surface at https://careers.mcafee.com/jobs is live, that the legacy https://careers.mcafee.com/global/en/search-results route still returns a 404-style wrapper, and that the anonymous jobs API at https://careers.mcafee.com/api/jobs returns 5 India openings when filtered with country=India, including Data Engineer / Analyst at https://careers.mcafee.com/jobs/1469?lang=en-us.',
  dryRunFile: 'mcafee/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MCAFEE_CATALOG
