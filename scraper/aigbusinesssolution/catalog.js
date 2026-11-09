import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(new URL('./script.js', import.meta.url))

export const AIG_BUSINESS_SOLUTION_CATALOG = {
  source: 'aigbusinesssolution',
  companyName: 'AIG Business Solution',
  officialBrandName: 'AIG Healthcare',
  adapter: 'script',
  modulePath,
  homepageUrl: 'https://aighealthcare.in/careers',
  companyCareerPage: 'https://aighealthcare.in/openings',
  companyDomain: 'aighealthcare.in',
  officialJobsHandoffUrl: 'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001',
  oracleCandidateExperienceUrl: 'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001',
  workspaceDomain: 'eiyi.fa.ap1.oraclecloud.com',
  listingApiBaseUrl: 'https://eiyi.fa.ap1.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  publicJobsBaseUrl: 'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/',
  siteNumber: 'CX_3001',
  atsPlatform: 'oracle-cloud',
  countryFilter: 'India',
  paginationStrategy: 'oracle-finder-api-offset-query',
  extractionStrategy: 'verified-careers-shell+verified-openings-page+oracle-candidate-experience+finder-api',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://aighealthcare.in/careers still links to the first-party openings page at https://aighealthcare.in/openings, that the openings page still includes Welcome to IKS Health and now hands applicants to the public Oracle Candidate Experience shell at https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001, and that the live India finder exposed eight public roles including Business Analyst in Hyderabad, Telangana, India.',
}

export default AIG_BUSINESS_SOLUTION_CATALOG
