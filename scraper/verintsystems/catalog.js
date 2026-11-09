import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(new URL('./script.js', import.meta.url))

export const VERINT_SYSTEMS_CATALOG = {
  source: 'verintsystems',
  companyName: 'Verint Systems',
  officialBrandName: 'Verint',
  adapter: 'script',
  modulePath,
  homepageUrl: 'https://www.verint.com/careers/',
  companyCareerPage: 'https://www.verint.com/careers/',
  oracleCandidateExperienceUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
  workspaceDomain: 'fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com',
  listingApiBaseUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/',
  siteNumber: 'CX',
  atsPlatform: 'oracle-candidate-experience',
  countryFilter: 'India',
  paginationStrategy: 'oracle-finder-location-query',
  extractionStrategy: 'verified-first-party-careers-page+oracle-candidate-experience+india-location-filter',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.verint.com/careers/ handed off to Oracle Candidate Experience at the fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com workspace and exposed Join Our Global Team on the first-party careers page.',
}

export default VERINT_SYSTEMS_CATALOG
