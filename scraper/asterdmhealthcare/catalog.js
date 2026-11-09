export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that the former Aster DM Healthcare India website redirects to https://www.asterqualitycare.com/, which identifies Aster DM Quality Care Ltd. as formerly Aster DM Healthcare Ltd. The official Careers navigation leads to https://www.asterqualitycare.com/careers, a general resume intake form with no public job listings or Oracle handoff. The former Oracle Candidate Experience board at https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX still responds, but its India finder remains at 2430 roles with its last visible postings in June 2026; this source does not collect those legacy listings.'

export const ASTER_DM_HEALTHCARE_CATALOG = {
  source: 'asterdmhealthcare',
  companyName: 'Aster DM Healthcare',
  adapter: 'script',
  modulePath: '../../scraper/asterdmhealthcare/script.js',
  companyCareerPage: 'https://www.asterqualitycare.com/careers',
  homepageUrl: 'https://www.asterqualitycare.com/',
  companyDomain: 'asterqualitycare.com',
  legacyHomepageUrl: 'https://www.asterdmhealthcare.in/',
  legacyCareersUrl: 'https://www.asterdmhealthcare.in/careers',
  oracleCandidateExperienceUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
  workspaceDomain: 'hcdt.fa.us2.oraclecloud.com',
  listingApiBaseUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/',
  siteNumber: 'CX',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'none',
  extractionStrategy: 'verified-official-homepage+verified-first-party-careers-intake',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'asterdmhealthcare/jobs.json',
}

export default ASTER_DM_HEALTHCARE_CATALOG

