import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG = {
  source: 'smartqbottlelabtechnologies',
  companyName: 'SmartQ - Bottle Lab Technologies',
  officialBrandName: 'SmartQ',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.thesmartq.com/',
  companyCareerPage: 'https://www.thesmartq.com/careers',
  jobsBoardUrl: 'https://careers.thesmartq.com/thesmartq/',
  tenantLookupUrl: 'https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.thesmartq.com',
  zwayamTenantGroupId: 'G1',
  zwayamCompanyId: 'MTU0ODE=',
  zwayamDetailCompanyId: '15481',
  searchApiUrl: 'https://public.zwayam.com/jobs/search',
  detailApiUrl: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  jobViewBaseUrl: 'https://careers.thesmartq.com/thesmartq/jobview',
  atsPlatform: 'first-party-careers-page-plus-zwayam-search-api',
  countryFilter: 'India',
  paginationStrategy: 'zwayam-search-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-zwayam-tenant+public-zwayam-search-api+public-zwayam-detail-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'thesmartq.com',
  dryRunFile: 'smartqbottlelabtechnologies/jobs.json',
  verifiedOn: '2026-08-04',
  verifiedPublicJobCount: 87,
  verifiedIndiaJobCount: 87,
  verifiedSampleJobUrl:
    'https://careers.thesmartq.com/thesmartq/jobview/key-account-manager-bangalore-karnataka-india-2026080410573840?id=1153661',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.thesmartq.com/careers is the live first-party SmartQ careers page, that its Explore Opportunities CTA points to the public SmartQ jobs shell at https://careers.thesmartq.com/thesmartq/, that the public Zwayam tenant lookup at https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.thesmartq.com returned SmartQ Bottle Lab Technologies Pvt Ltd with tenantGroupId G1, and that the public Zwayam search and detail APIs returned 87 India jobs including Key Account Manager, Executive - Operations, and Senior Implementation Manager. The public board currently labels those listings Hidden/Closed/jobVisibiltyLevel N, but the first-party shell, public detail API, and CAREERSITE apply configuration remained live on the verified date, so this provider is implemented against the verified public SmartQ board contract.',
}

export default SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG
