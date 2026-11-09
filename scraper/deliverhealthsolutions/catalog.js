import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 15, 2026 that https://ai.deliverhealth.com/careers is the live first-party DeliverHealth careers page, that the current page now exposes the public ADP Workforce Now board directly in a visible Browse Open Roles link at https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=4228bffd-fe58-4423-b90e-accba06e7569&ccId=19000101_000001&lang=en_US, and that the linked public ADP board plus its job-requisitions and search-filters feeds still return no visible requisitions or filters. DeliverHealth therefore still has a trustworthy public jobs surface but no live openings on the verified date.'

export const DELIVERHEALTH_SOLUTIONS_CATALOG = {
  source: 'deliverhealthsolutions',
  companyName: 'DeliverHealth Solutions',
  officialBrandName: 'DeliverHealth',
  adapter: 'script',
  homepageUrl: 'https://ai.deliverhealth.com/',
  companyCareerPage: 'https://ai.deliverhealth.com/careers',
  officialJobsBoardUrl:
    'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=4228bffd-fe58-4423-b90e-accba06e7569&ccId=19000101_000001&lang=en_US',
  jobsApiUrl:
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?cid=4228bffd-fe58-4423-b90e-accba06e7569&ccId=19000101_000001&lang=en_US&locale=en_US&$top=100',
  searchFiltersApiUrl:
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/getSearchFilters?cid=4228bffd-fe58-4423-b90e-accba06e7569&ccId=19000101_000001&lang=en_US&locale=en_US',
  companyDomain: 'deliverhealth.com',
  atsPlatform: 'adp-workforcenow',
  countryFilter: 'India',
  paginationStrategy: 'single-public-adp-job-requisitions-call',
  extractionStrategy:
    'verified-first-party-careers-page-direct-adp-link-or-bundle+verified-public-adp-board+job-requisitions-api+detail-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'deliverhealthsolutions/jobs.json',
}

export default DELIVERHEALTH_SOLUTIONS_CATALOG
