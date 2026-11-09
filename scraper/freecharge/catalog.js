import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 2, 2026 that https://www.freecharge.in/ is the live first-party homepage for the backlog company name FreeCharge, that its Careers navigation points to https://careers.freecharge.in, and that the first-party careers page at https://careers.freecharge.in/ sends candidates to the public RippleHire board at https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list. Verified that the public board shell is live at the same RippleHire URL on August 2, 2026, and pinned the associated RippleHire jobs endpoint at https://freecharge.ripplehire.com/candidate/candidatejobsearch for extraction.'

export const FREECHARGE_CATALOG = {
  source: 'freecharge',
  companyName: 'FreeCharge',
  officialBrandName: 'Freecharge',
  adapter: 'script',
  companyCareerPage: 'https://careers.freecharge.in/',
  homepageUrl: 'https://www.freecharge.in/',
  portalOrigin: 'https://freecharge.ripplehire.com',
  officialCareersHandoffUrl:
    'https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list',
  jobBoardUrl:
    'https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list',
  jobsApiUrl: 'https://freecharge.ripplehire.com/candidate/candidatejobsearch',
  atsPlatform: 'ripplehire',
  countryFilter: 'India',
  paginationStrategy: 'page-param-on-public-ripplehire-board',
  extractionStrategy: 'official-careers-handoff+ripplehire-list-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'freecharge.in',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default FREECHARGE_CATALOG
