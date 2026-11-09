import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.icertis.com/company/careers/ is the live first-party Icertis careers page and that its Explore Open Roles CTA hands candidates to the public Oracle Candidate Experience board at https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/?. Verified that the public India finder at https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=Jobs-at-Icertis,limit=5,offset=0,location=India returned 9 India roles on July 16, 2026, including Lead Functional Consultant, Customer Support(L2) in Pune, Maharashtra, India, and that the public detail API is live at https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%227407%22,siteNumber=Jobs-at-Icertis.'

export const ICERTIS_CATALOG = {
  source: 'icertis',
  companyName: 'Icertis',
  officialBrandName: 'Icertis',
  adapter: 'script',
  companyCareerPage: 'https://www.icertis.com/company/careers/',
  oracleCandidateExperienceUrl:
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/?',
  workspaceDomain: 'iaaviz.fa.ocs.oraclecloud.com',
  listingApiBaseUrl:
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl:
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl:
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/',
  siteNumber: 'Jobs-at-Icertis',
  candidateExperienceShellSiteNumber: 'CX_1',
  atsPlatform: 'oracle-cloud',
  countryFilter: 'India',
  paginationStrategy: 'offset-query-location-filter',
  extractionStrategy:
    'verified-first-party-careers-page+oracle-cloud-candidate-experience+oracle-cloud-india-finder-api+oracle-cloud-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'icertis.com',
  verifiedOn: '2026-07-16',
  verifiedIndiaRoleCount: 9,
  verifiedSampleJobId: '7407',
  verifiedSampleJobUrl:
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/7407',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'icertis/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ICERTIS_CATALOG
