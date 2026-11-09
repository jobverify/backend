import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.cubic.com/global-careers still links to the public Cubic Workday board, whose jobs API exposed 55 global postings across three pages. Of 26 India-addressed candidates, the current Workday detail API identified 23 active India roles in the Cubic Transportation Systems business unit. The previously pinned Workday job detail has been removed; the scraper now validates each current posting through its live detail API response and returns the CTS subset.'

export const CUBIC_TRANSPORTATION_SYSTEMS_CATALOG = {
  source: 'cubictransportationsystems',
  companyName: 'Cubic Transportation Systems',
  officialBrandName: 'Cubic Transportation Systems',
  adapter: 'script',
  homepageUrl: 'https://www.cubic.com/',
  companyCareerPage: 'https://www.cubic.com/global-careers',
  officialWorkdayBoardUrl: 'https://cubic.wd1.myworkdayjobs.com/cubic_global_careers/jobs',
  jobsApiUrl: 'https://cubic.wd1.myworkdayjobs.com/wday/cxs/cubic/cubic_global_careers/jobs',
  companyDomain: 'cubic.com',
  atsPlatform: 'workday-cxs-jobs-and-detail-api',
  countryFilter: 'India',
  paginationStrategy: 'workday-cxs-offset-pagination-until-short-page',
  extractionStrategy:
    'verified-cubic-global-careers-handoff-or-incapsula-block+verified-workday-board+india-summary-candidate-filter+current-detail-api-business-unit-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedPublicJobCount: 55,
  verifiedIndiaBoardJobCount: 26,
  verifiedIndiaJobCount: 23,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'cubictransportationsystems/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CUBIC_TRANSPORTATION_SYSTEMS_CATALOG
