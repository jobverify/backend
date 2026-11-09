import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAPESTART_CATALOG = {
  source: 'capestart',
  companyName: 'CapeStart',
  officialBrandName: 'CapeStart',
  adapter: 'script',
  officialCareersPageUrl: 'https://careers.capestart.com/capestart/',
  companyCareerPage: 'https://careers.capestart.com/capestart/jobslist',
  zwayamTenantLookupUrl:
    'https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.capestart.com',
  zwayamTenantGroupId: 'G1',
  zwayamCompanyId: 'MTUzNzE=',
  zwayamDetailCompanyId: '15371',
  zwayamSearchUrl: 'https://public.zwayam.com/jobs/search',
  zwayamJobDetailUrl: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  publicJobBaseUrl: 'https://careers.capestart.com/capestart/jobview',
  atsPlatform: 'zwayam',
  countryFilter: 'India',
  paginationStrategy: 'public-zwayam-total-count-plus-page-size',
  extractionStrategy:
    'verified-first-party-careers-shell+verified-zwayam-tenant+public-zwayam-search-api+public-zwayam-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'careers.capestart.com',
  verifiedOn: '2026-07-18',
  verifiedJobCount: 36,
  sampleJobUrl:
    'https://careers.capestart.com/capestart/jobview/junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.capestart.com/capestart/jobslist is the live first-party CapeStart jobs shell and that it publishes jobs through Zwayam. The public tenant lookup at https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.capestart.com returned tenantGroupId G1, the public jobs search API returned 36 public jobs for companyId MTUzNzE= on careers.capestart.com, and the public detail API resolved live data for Junior Frontend Developer.',
  dryRunFile: 'capestart/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CAPESTART_CATALOG
