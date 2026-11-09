import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://jobs.bentley.com/?locale=en_US redirects to the public Workday board https://bentleysystems.wd5.myworkdayjobs.com/bentley, linked from https://www.bentley.com/company/careers/. The Workday API at https://bentleysystems.wd5.myworkdayjobs.com/wday/cxs/bentleysystems/bentley/jobs reports seven India roles in Mumbai and Pune, including Technical Account Manager. Public detail pages on the same board expose job descriptions and application URLs.'

export const BENTLEY_SYSTEMS_CATALOG = {
  source: 'bentleysystems',
  companyName: 'Bentley Systems',
  officialBrandName: 'Bentley Systems',
  adapter: 'script',
  homepageUrl: 'https://www.bentley.com/',
  companyCareerPage: 'https://www.bentley.com/company/careers/',
  officialJobsHostUrl: 'https://jobs.bentley.com/?locale=en_US',
  workdayBoardUrl: 'https://bentleysystems.wd5.myworkdayjobs.com/bentley',
  workdayJobsApiUrl: 'https://bentleysystems.wd5.myworkdayjobs.com/wday/cxs/bentleysystems/bentley/jobs',
  indiaSearchUrl: 'https://jobs.bentley.com/search/?searchby=location&q=&locationsearch=India&locale=en_US',
  sampleJobUrl: 'https://bentleysystems.wd5.myworkdayjobs.com/bentley/job/Mumbai-Maharashtra-India/Technical-Account-Manager_RC125',
  companyDomain: 'bentley.com',
  atsPlatform: 'official-workday-board',
  countryFilter: 'India',
  paginationStrategy: 'workday-india-location-facets-with-pagination',
  extractionStrategy:
    'verified-bentley-careers-handoff+workday-india-location-facets+workday-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'bentleysystems/jobs.json',
}

export default BENTLEY_SYSTEMS_CATALOG
