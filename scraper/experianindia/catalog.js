import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the live company-owned public jobs surface for Experian India is https://jobs.experian.com/jobs, that the page title is "Search Jobs | Experian", that it includes a Global Careers nav link to https://www.experian.com/careers, that page 2 is exposed at https://jobs.experian.com/jobs?page=2, that the live India filter 422 exposes 38 India roles, that the page showed 369 Jobs overall, and that the live India detail page https://jobs.experian.com/job/product-manager-in-mumbai-india-jid-3726 exposes the first-party apply workflow https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=3726.'

export const EXPERIAN_INDIA_CATALOG = {
  source: 'experianindia',
  companyName: 'Experian India',
  officialBrandName: 'Experian',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'experianindia/jobs.json',
  homepageUrl: 'https://www.experian.com/',
  globalCareersUrl: 'https://www.experian.com/careers',
  companyCareerPage: 'https://jobs.experian.com/jobs',
  jobsPageUrl: 'https://jobs.experian.com/jobs',
  verifiedJobUrl: 'https://jobs.experian.com/job/product-manager-in-mumbai-india-jid-3726',
  verifiedApplyUrl: 'https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=3726',
  verifiedIndiaLocationFilterId: '422',
  verifiedIndiaLocationCount: 38,
  verifiedTotalJobsCount: 369,
  atsPlatform: 'first-party-attrax',
  countryFilter: 'India',
  paginationStrategy: 'first-party-attrax-html-pagination',
  extractionStrategy:
    'verified-company-owned-jobs-page+global-careers-nav-link+india-location-filter+attrax-india-cards+detail-page-workflow-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'jobs.experian.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EXPERIAN_INDIA_CATALOG
