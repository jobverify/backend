import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.orbitouch-hr.com/jobs is the live official OrbiTouch HR public jobs board, that the first-party Wix jobs surface exposed 16 public jobs across its title filter options, and that first-party detail pages such as https://www.orbitouch-hr.com/jobs/recruitment-officer- exposed title, location, job type, workspace, and role description content.'

export const ORBITOUCH_CATALOG = {
  source: 'orbitouch',
  companyName: 'OrbiTouch',
  officialBrandName: 'orbiTouch HR',
  legalEntityName: 'OrbiTouch Outsourcing Private Limited',
  adapter: 'script',
  homepageUrl: 'https://www.orbitouch-hr.com/',
  companyCareerPage: 'https://www.orbitouch-hr.com/jobs',
  submitCvUrl: 'https://www.orbitouch-hr.com/careers',
  sampleJobUrl: 'https://www.orbitouch-hr.com/jobs/recruitment-officer-',
  companyDomain: 'orbitouch-hr.com',
  atsPlatform: 'wix-dynamic-jobs-board',
  countryFilter: 'India',
  paginationStrategy: 'first-party-wix-jobs-list-plus-derived-dynamic-detail-pages',
  extractionStrategy: 'verified-first-party-jobs-list+visible-list-cards+warmup-title-options+derived-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedPublicJobCount: 16,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'orbitouch/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ORBITOUCH_CATALOG
