import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EMIDS_TECHNOLOGIES_LIMITED_CATALOG = {
  source: 'emidstechnologieslimited',
  companyName: 'Emids Technologies Limited',
  officialBrandName: 'Emids',
  adapter: 'script',
  homepageUrl: 'https://www.emids.com/',
  companyCareerPage: 'https://www.emids.com/careers/',
  officialJobsBoardUrl: 'https://emids.bibha.ai/career/emids/',
  tenantCode: 'emids',
  publicApiKey: 'JzLueUKODg9oROwgxqjRe52eZkIQPHyyayYsxAdwshdsjhds23sgdshdg',
  workspaceDomain: 'emids.bibha.ai',
  listingApiBaseUrl:
    'https://emids.bibha.ai/api/bibha-recruiter-job-management/v2/career-config/jobs',
  detailApiBaseUrl:
    'https://emids.bibha.ai/api/bibha-recruiter-job-management/v2/career-config/job',
  publicJobsBaseUrl:
    'https://emids.bibha.ai/career/emids/apply/',
  oracleCandidateExperienceUrl:
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs',
  oracleListingApiBaseUrl:
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  oracleDetailApiBaseUrl:
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  oraclePublicJobsBaseUrl:
    'https://fa-eupt-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  siteNumber: 'CX_1',
  companyDomain: 'emids.com',
  atsPlatform: 'bibha-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'tenant-jobs-api-page-and-limit-query',
  extractionStrategy:
    'verified-first-party-careers-page+verified-bibha-careers-shell+public-bibha-jobs-api+public-bibha-job-detail-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedPublicJobCount: 12,
  verifiedIndiaJobCount: 12,
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.emids.com/careers/ remained the first-party Emids careers page and that its Explore Open Roles CTA now hands candidates to the public Bibha board at https://emids.bibha.ai/career/emids/. The same-domain public Bibha jobs API returned 12 India jobs on the verified date, including Architect, Tech Lead, and Senior Consultant roles.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default EMIDS_TECHNOLOGIES_LIMITED_CATALOG
