import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.kimobility.com/careers is the official Ki Mobility careers page and hands off directly to the public ADP Workforce Now board at https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US. Verified the public ADP job-requisitions feed and search-filters feed for that board, and the live search filters exposed United States (Countrywide) but no India option, so there were no India roles on the verified date while the visible 12 requisitions were all US-based.'

export const KI_MOBILITY_CATALOG = {
  source: 'kimobility',
  companyName: 'Ki Mobility',
  officialBrandName: 'Ki Mobility',
  adapter: 'script',
  homepageUrl: 'https://www.kimobility.com/',
  companyCareerPage: 'https://www.kimobility.com/careers',
  officialJobsBoardUrl:
    'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US',
  jobsApiUrl:
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&locale=en_US&$top=100',
  searchFiltersApiUrl:
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/getSearchFilters?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&locale=en_US',
  companyDomain: 'kimobility.com',
  atsPlatform: 'adp-workforcenow',
  countryFilter: 'India',
  paginationStrategy: 'single-public-adp-job-requisitions-call',
  extractionStrategy:
    'verified-first-party-careers-page+verified-public-adp-board+job-requisitions-api+detail-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'kimobility/jobs.json',
}

export default KI_MOBILITY_CATALOG
