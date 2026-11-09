import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG = {
  source: 'hylandsoftwaresolutionsindia',
  companyName: 'Hyland Software Solutions India LLP',
  officialBrandName: 'Hyland',
  adapter: 'script',
  homepageUrl: 'https://www.hyland.com/en',
  companyCareerPage: 'https://www.hyland.com/en/company/careers',
  jobsSearchUrl: 'https://careers-hyland.icims.com/jobs/search?pr=1&in_iframe=1',
  sampleRemoteIndiaJobUrl:
    'https://careers-hyland.icims.com/jobs/14187/senior-product-designer---cloud-update-service/job?in_iframe=1',
  sampleHyderabadJobUrl:
    'https://careers-hyland.icims.com/jobs/13938/senior-cyber-security-analyst-%28cybersecurity---identity-and-access-management%29/job?in_iframe=1',
  atsPlatform: 'icims',
  countryFilter: 'India',
  paginationStrategy: 'icims-next-page-search',
  extractionStrategy: 'first-party-careers-handoff-plus-icims-listings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'hyland.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://www.hyland.com/en/company/careers remained the live first-party Hyland careers page, that it still exposed the public iCIMS handoff links, and that the stable public listings surface had moved to https://careers-hyland.icims.com/jobs/search?pr=1&in_iframe=1 where current India roles included Hyderabad India Office and Remote - India openings.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG
