import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EMERSON_INDIA_CATALOG = {
  source: 'emersonindia',
  companyName: 'Emerson India',
  officialBrandName: 'Emerson',
  adapter: 'script',
  companyCareerPage: 'https://www.emerson.com/en/corporate/careers',
  companyDomain: 'emerson.com',
  oracleCandidateExperienceUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
  workspaceDomain: 'hdjq.fa.us2.oraclecloud.com',
  listingApiBaseUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  siteNumber: 'CX_1',
  atsPlatform: 'oracle-cloud',
  countryFilter: 'India',
  paginationStrategy: 'offset-query',
  extractionStrategy:
    'verified-first-party-careers-page+oracle-cloud-finder-api+oracle-cloud-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.emerson.com/en/corporate/careers is the live first-party Emerson careers page and hands candidates to the public Oracle Candidate Experience board at https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1. The public India finder currently exposes 146 India roles, including Analyst I Finance in Pune, Maharashtra.',
  dryRunFile: 'emersonindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EMERSON_INDIA_CATALOG
