import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 23, 2026 that https://www.manh.com/en-in/about-us/careers is Manhattan Associates\' first-party careers page and its Search Opportunities links hand off to the official public Workday board at https://manh.wd5.myworkdayjobs.com/en-US/External/jobs. The public Workday jobs API at https://manh.wd5.myworkdayjobs.com/wday/cxs/manh/External/jobs exposes Bangalore as location facet ba9cd6cb4b2310c69665202f09dbe48e and returned 3 live Bangalore openings, including Senior/Finance Administrator (16924).'

export const MANHATTEN_CATALOG = {
  source: 'manhatten',
  companyName: 'Manhattan Associates',
  officialBrandName: 'Manhattan Associates',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'manhatten/jobs.json',
  companyCareerPage: 'https://www.manh.com/en-in/about-us/careers',
  alternateCareerPages: [
    'https://manh.wd5.myworkdayjobs.com/en-US/External/jobs',
  ],
  officialWorkdayBoardUrl: 'https://manh.wd5.myworkdayjobs.com/en-US/External/jobs',
  jobsApiUrl: 'https://manh.wd5.myworkdayjobs.com/wday/cxs/manh/External/jobs',
  verifiedIndiaLocationName: 'Bangalore',
  verifiedIndiaLocationFacetId: 'ba9cd6cb4b2310c69665202f09dbe48e',
  verifiedIndiaJobUrl:
    'https://manh.wd5.myworkdayjobs.com/en-US/External/job/Bangalore/Senior-Finance-Administrator_16924',
  atsPlatform: 'workday-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'dynamic-workday-india-locations-facet-plus-full-offset-pagination',
  extractionStrategy:
    'verified-first-party-careers-handoff+official-workday-board+unfiltered-location-facet-discovery+india-filtered-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'manh.com',
  verifiedOn: '2026-07-23',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MANHATTEN_CATALOG
