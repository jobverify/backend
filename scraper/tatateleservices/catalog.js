import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://www.tatatelebusiness.com/careers/ is the live official Tata Tele Business Services careers page for Tata Teleservices Limited and that it now hands candidates to the public Oracle Candidate Experience route at https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location. Verified the Oracle shell still exposes data-apibaseurl https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com:443 with Tata Teleservices Career Portal metadata while the public India finder for site number CX_1001 returned 11 India roles on the verified date, including Lead Product - Managed WiFi (job 2411) in Navi Mumbai, Maharashtra, India.'

export const TATA_TELESERVICES_CATALOG = {
  source: 'tatateleservices',
  companyName: 'Tata Teleservices',
  officialBrandName: 'Tata Teleservices Limited',
  adapter: 'script',
  homepageUrl: 'https://www.tatatelebusiness.com/',
  companyCareerPage: 'https://www.tatatelebusiness.com/careers/',
  officialJobsHandoffUrl:
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location',
  oracleCandidateExperienceUrl:
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location',
  workspaceDomain: 'fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com',
  listingApiBaseUrl:
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl:
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl:
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/',
  siteNumber: 'CX_1001',
  companyDomain: 'tatatelebusiness.com',
  atsPlatform: 'oracle-cloud',
  countryFilter: 'India',
  paginationStrategy: 'offset-query',
  extractionStrategy:
    'verified-first-party-careers-handoff+verified-oracle-candidate-shell+oracle-cloud-finder-api+oracle-cloud-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedIndiaJobCount: 11,
  verifiedSampleJobUrl:
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/2411',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'tatateleservices/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TATA_TELESERVICES_CATALOG
