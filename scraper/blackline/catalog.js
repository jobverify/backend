import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 23, 2026 that https://careers.blackline.com/careers-home/ is BlackLine\'s first-party careers entry point and redirects job seekers to the official public Workday board at https://blackline.wd108.myworkdayjobs.com/BlackLineCareers. The public Workday jobs API at https://blackline.wd108.myworkdayjobs.com/wday/cxs/blackline/BlackLineCareers/jobs exposes Bengaluru as location facet 9574f3b33005100115a9633a90c20000 and returned 20 live Bengaluru openings, including Senior Software Engineer (000117).'

export const BLACKLINE_CATALOG = {
  source: 'blackline',
  companyName: 'BlackLine',
  officialBrandName: 'BlackLine',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'blackline/jobs.json',
  companyCareerPage: 'https://careers.blackline.com/careers-home/',
  alternateCareerPages: [
    'https://blackline.wd108.myworkdayjobs.com/BlackLineCareers',
  ],
  officialWorkdayBoardUrl: 'https://blackline.wd108.myworkdayjobs.com/BlackLineCareers',
  jobsApiUrl: 'https://blackline.wd108.myworkdayjobs.com/wday/cxs/blackline/BlackLineCareers/jobs',
  verifiedIndiaLocationName: 'Bengaluru',
  verifiedIndiaLocationFacetId: '9574f3b33005100115a9633a90c20000',
  verifiedIndiaJobUrl:
    'https://blackline.wd108.myworkdayjobs.com/BlackLineCareers/job/Bengaluru/Senior-Software-Engineer_000117',
  atsPlatform: 'workday-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'dynamic-workday-india-locations-facet-plus-full-offset-pagination',
  extractionStrategy:
    'verified-first-party-careers-redirect+official-workday-board+unfiltered-location-facet-discovery+india-filtered-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'blackline.com',
  verifiedOn: '2026-07-23',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default BLACKLINE_CATALOG
