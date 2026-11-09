import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APPS_ASSOCIATES_CATALOG = {
  source: 'appsassociates',
  companyName: 'Apps Associates',
  officialBrandName: 'Apps Associates',
  adapter: 'script',
  homepageUrl: 'https://appsassociates.com/',
  officialCareersPageUrl: 'https://appsassociates.com/careers/',
  companyCareerPage: 'https://appsassociates.com/jobs/',
  oracleCandidateExperienceUrl: 'https://appsassociates.com/jobs/',
  workspaceDomain: 'ebdt.fa.us2.oraclecloud.com',
  listingApiBaseUrl:
    'https://ebdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl:
    'https://ebdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl: 'https://appsassociates.com/jobs/#en/sites/CX_9003/job/',
  siteNumber: 'CX_9003',
  atsPlatform: 'oracle-candidate-experience',
  countryFilter: 'India',
  paginationStrategy: 'oracle-candidate-experience-india-search',
  extractionStrategy:
    'verified-first-party-careers-page+verified-oracle-candidate-experience-shell+oracle-listing-api+oracle-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'appsassociates.com',
  verifiedOn: '2026-07-26',
  verifiedPublicJobCount: 29,
  verifiedSurfaceSummary:
    'Verified on Sunday, July 26, 2026 that https://appsassociates.com/careers/ is the live first-party Apps Associates careers page, that its current-job-openings CTA now hands candidates to the first-party Oracle Candidate Experience shell at https://appsassociates.com/jobs/ with siteNumber CX_9003 on workspace ebdt.fa.us2.oraclecloud.com, and that the public India finder currently exposes 29 India roles including HCM Cloud Technical Consultant in Hyderabad, Telangana, India.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default APPS_ASSOCIATES_CATALOG
