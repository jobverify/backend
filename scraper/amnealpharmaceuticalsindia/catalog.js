import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMNEAL_PHARMACEUTICALS_INDIA_CATALOG = {
  source: 'amnealpharmaceuticalsindia',
  companyName: 'Amneal Pharmaceuticals India',
  officialBrandName: 'Amneal India',
  adapter: 'script',
  companyCareerPage: 'https://india.amneal.com/careers/search-our-career-opportunities/',
  companyDomain: 'india.amneal.com',
  officialCareersPageUrl: 'https://india.amneal.com/careers/',
  oracleCandidateExperienceUrl:
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001',
  workspaceDomain: 'hcfa.fa.us2.oraclecloud.com',
  listingApiBaseUrl:
    'https://hcfa.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl:
    'https://hcfa.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl:
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/',
  siteNumber: 'CX_5001',
  atsPlatform: 'oracle-cloud',
  countryFilter: 'India',
  paginationStrategy: 'offset-query',
  extractionStrategy:
    'verified-first-party-india-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://india.amneal.com/careers/ links Search Our Career Opportunities to https://india.amneal.com/careers/search-our-career-opportunities/, and that first-party India page hands candidates to the public Oracle Candidate Experience board at https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001. The public India finder currently exposes 180 India roles, including Deputy Manager / Manager - Clinical Trials management in Ahmedabad City, Gujarat.',
  dryRunFile: 'amnealpharmaceuticalsindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AMNEAL_PHARMACEUTICALS_INDIA_CATALOG
