import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NATIONAL_INSTRUMENTS_CATALOG = {
  source: 'nationalinstruments',
  companyName: 'National Instruments',
  officialBrandName: 'NI',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.ni.com/',
  companyCareerPage: 'https://www.ni.com/en/about-ni/careers.html',
  redirectedCareerPageUrl: 'https://www.emerson.com/en/corporate/careers',
  companyDomain: 'ni.com',
  oracleCandidateExperienceUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs',
  oracleCandidateExperienceRootUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
  workspaceDomain: 'hdjq.fa.us2.oraclecloud.com',
  listingApiBaseUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl:
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  siteNumber: 'CX_1',
  countryFilter: 'India',
  targetBusinessUnitId: '300012142648830',
  targetLegalEmployerId: '300012194279570',
  atsPlatform: 'oracle-cloud',
  paginationStrategy: 'offset-query',
  extractionStrategy:
    'verified-ni-careers-redirect+emerson-handoff+oracle-cloud-finder-api+oracle-cloud-detail-api+business-unit-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.ni.com/en/about-ni/careers.html now redirects to the Emerson careers page at https://www.emerson.com/en/corporate/careers, that the Emerson page publicly links candidates into the Oracle Candidate Experience shell at https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs, and that the live India finder exposed eight National Instruments / Test & Measurement roles when filtered to BusinessUnitId 300012142648830 and LegalEmployerId 300012194279570.',
}

export default NATIONAL_INSTRUMENTS_CATALOG
