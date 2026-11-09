import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 7, 2026 that https://bdl-india.in/ is the live official Bharat Dynamics Limited homepage and that its HR menu links the first-party recruitment table at https://bdl-india.in/recruitments. The root recruitments page now titles itself "Recruitments | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India." while the archive continuation remains at https://bdl-india.in/recruitments?page=1, and the public table still links out to https://www.ncs.gov.in/. Live checks found one currently actionable first-party notice: Notification – Recruitment for the posts of Contract Engineer (Field Firing) on Contractual basis in BDL, issued on August 6, 2026, with the notice PDF hosted on bdl-india.in. The scraper keeps the conservative actionable-notice filter to avoid selection lists, addenda, interview schedules, and archival notices.'

export const BHARAT_DYNAMICS_CATALOG = {
  source: 'bharatdynamics',
  companyName: 'Bharat Dynamics',
  officialBrandName: 'Bharat Dynamics Limited (BDL)',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'bharatdynamics/jobs.json',
  homepageUrl: 'https://bdl-india.in/',
  companyCareerPage: 'https://bdl-india.in/recruitments',
  pageTwoUrl: 'https://bdl-india.in/recruitments?page=1',
  externalVacancyPortalUrl: 'https://www.ncs.gov.in/',
  companyDomain: 'bdl-india.in',
  atsPlatform: 'official-recruitment-table',
  countryFilter: 'India',
  paginationStrategy: 'official-recruitments-root-plus-page-query',
  extractionStrategy:
    'verified-homepage-recruitment-handoff+paginated-official-recruitment-table+conservative-actionable-notice-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedPublicJobCount: 1,
  verifiedIndiaJobCount: 1,
  verifiedSampleJobTitle: 'Notification – Recruitment for the posts of Contract Engineer (Field Firing) on Contractual basis in BDL',
  verifiedSampleJobUrl: 'https://www.bdl-india.in/sites/default/files/Nofification-Recruitment_contract-Engineer%28field-firing%29.pdf',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default BHARAT_DYNAMICS_CATALOG
