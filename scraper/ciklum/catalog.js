import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CIKLUM_CATALOG = {
  source: 'ciklum',
  companyName: 'Ciklum',
  officialBrandName: 'Ciklum',
  adapter: 'script',
  officialCareersLandingUrl: 'https://jobs.ciklum.com/offices/india/',
  companyCareerPage:
    'https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243',
  oracleCandidateExperienceUrl:
    'https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243',
  workspaceDomain: 'ialmme.fa.ocs.oraclecloud.com',
  listingApiBaseUrl:
    'https://ialmme.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl:
    'https://ialmme.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl: 'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/',
  siteNumber: 'CX_1001',
  selectedLocationsFacet: '300000000468243',
  atsPlatform: 'oracle-cloud',
  countryFilter: 'India',
  paginationStrategy: 'oracle-location-facet-offset-pagination',
  extractionStrategy:
    'verified-first-party-india-page+verified-first-party-oracle-shell+oracle-location-facet-listing-api+oracle-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'jobs.ciklum.com',
  verifiedOn: '2026-07-18',
  verifiedJobCount: 24,
  sampleJobUrl: 'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/3469',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://jobs.ciklum.com/offices/india/ is the live first-party India careers landing page for Ciklum and that it hands candidates to the first-party Oracle Candidate Experience shell at https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243. The public Oracle shell exposes siteNumber CX_1001 on workspace ialmme.fa.ocs.oraclecloud.com, the location-facet listing API with selectedLocationsFacet=300000000468243 returned TotalJobsCount=24, and the public detail API resolved live role data including Senior Automation QA Engineer.',
  dryRunFile: 'ciklum/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CIKLUM_CATALOG
