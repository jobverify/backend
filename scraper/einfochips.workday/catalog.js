import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.einfochips.com/careers/ is the live first-party eInfochips careers page and that its Apply Now call-to-action links to the public Arrow careers search at https://careers.arrow.com/us/en/search-results?keywords=einfochips. Verified that the Arrow search surface exposes the public Arrow Workday board at https://arrow.wd1.myworkdayjobs.com/AC and that the public Workday jobs API at https://arrow.wd1.myworkdayjobs.com/wday/cxs/arrow/AC/jobs returns 33 India roles when queried with searchText=einfochips and filtered to the India country facet id c4f78be1a8f14da0ab49ce1162348a5e, including https://arrow.wd1.myworkdayjobs.com/AC/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449 and its public apply URL.'

export const EINFOCHIPS_CATALOG = {
  source: 'einfochips',
  companyName: 'eInfochips',
  officialBrandName: 'eInfochips',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'einfochips.workday/jobs.json',
  homepageUrl: 'https://www.einfochips.com/',
  companyCareerPage: 'https://www.einfochips.com/careers/',
  officialArrowSearchUrl: 'https://careers.arrow.com/us/en/search-results?keywords=einfochips',
  officialWorkdayBoardUrl: 'https://arrow.wd1.myworkdayjobs.com/AC',
  jobsApiUrl: 'https://arrow.wd1.myworkdayjobs.com/wday/cxs/arrow/AC/jobs',
  verifiedKeyword: 'einfochips',
  verifiedIndiaCountryFacetDescriptor: 'India',
  verifiedIndiaCountryFacetId: 'c4f78be1a8f14da0ab49ce1162348a5e',
  verifiedIndiaJobUrl:
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449',
  verifiedIndiaApplyUrl:
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449/apply',
  companyDomain: 'einfochips.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-handoff-plus-keyworded-workday-country-facet',
  extractionStrategy:
    'verified-einfochips-careers-page+verified-arrow-search-page+verified-arrow-workday-board+keyworded-workday-jobs-api+india-country-facet',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EINFOCHIPS_CATALOG
