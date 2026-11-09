import {createNativeAbsoluteScraper} from './native.js'
export {CAREERS_URL,JOB_BOARD_URL,hasOfficialHomepageSignal,hasOfficialCareersSignal,hasOfficialJobBoardSignal,extractJobBoardUrl,extractJobBoardListings,extractJobDetail} from './native.js'
export const SOURCE='absolute'
export const COMPANY='Absolute'
export const OFFICIAL_BRAND_NAME='Absolute Security'
export const VERIFIED_AT='2026-10-27'
export const HOMEPAGE_URL='https://www.absolute.com/'
export const DETAIL_URL_PATTERN='https://jobs.jobvite.com/absolute/job/{jobvite_id}'
export const PROVIDER_METADATA={
  source:SOURCE,companyName:COMPANY,officialBrandName:OFFICIAL_BRAND_NAME,adapter:'script',modulePath:'../../scraper/absolute/script.js',
  companyCareerPage:'https://www.absolute.com/company/careers/',officialCareersHandoffUrl:'https://jobs.jobvite.com/absolute/',atsPlatform:'jobvite',countryFilter:'India',
  paginationStrategy:'runtime-all-board-pages-and-closing-inventory-recheck',extractionStrategy:'runtime-corporate-hiring-channels+all-native-JobPosting-details+closing-details-recheck',
  parser:'custom-script',normalizationProfile:'engineering-default',companyDomain:'absolute.com',verifiedOn:VERIFIED_AT,zeroResultPolicy:'evidence-required',
  verifiedSurfaceSummary:'Current public corporate careers page binds to Absolute Jobvite. Runtime checks every advertised hiring channel and locale, all board pages and full native JobPosting details, explicit work countries, native dates and public application identity, followed by closing corporate, board and detail rechecks. Unknown coverage suppresses authoritative totals.',
  dryRunFile:'absolute/jobs.json',
}
export const createAbsoluteScraper=createNativeAbsoluteScraper
export const run=async(options={})=>createAbsoluteScraper(options).run(options)
