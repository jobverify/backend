import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://corporate.payu.in/careers/ is the live official PayU India careers page, that its "Who do we hire? We hire the right tribe" section still links View all open positions to https://corporate.payu.com/job-board/, and that the linked public PayU Global job board currently shows 16 of 16 positions in Prague, Czech Republic; Poznan and Warsaw, Poland; and Bucharest, Romania, with no India locations published. There is no trustworthy public India jobs surface for PayU on the verified date, so this provider returns an empty array until India openings appear on the verified official hiring flow.'

export const PAYU_CATALOG = {
  source: 'payu',
  companyName: 'PayU',
  officialBrandName: 'PayU India',
  adapter: 'script',
  homepageUrl: 'https://corporate.payu.in/',
  companyCareerPage: 'https://corporate.payu.in/careers/',
  globalJobBoardUrl: 'https://corporate.payu.com/job-board/',
  companyDomain: 'corporate.payu.in',
  atsPlatform: 'official-careers-global-board-no-india-jobs',
  countryFilter: 'India',
  paginationStrategy: 'official-india-careers-page-plus-global-job-board-no-india-validation',
  extractionStrategy:
    'verified-india-careers-page+verified-global-job-board+verified-no-india-locations-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedGlobalJobCount: 16,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'payu/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PAYU_CATALOG
