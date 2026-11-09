import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Tuesday, August 4, 2026 that https://www.splashlearn.com/careers is still the live official SplashLearn careers page, that the accessible first-party page now carries the Careers at SplashLearn title plus culture and founders sections including Arpit Jain and the StudyPad, Inc. trademark footer, and that there is still no trustworthy public jobs surface for the exact-name SplashLearn row because the accessible first-party surface does not enumerate a trustworthy public jobs board or job-detail route.'

export const SPLASHLEARN_CATALOG = {
  source: 'splashlearn',
  companyName: 'SplashLearn',
  officialBrandName: 'SplashLearn',
  adapter: 'script',
  companyCareerPage: 'https://www.splashlearn.com/careers',
  officialCareersPageUrl: 'https://www.splashlearn.com/careers',
  companyDomain: 'splashlearn.com',
  atsPlatform: 'official-careers-page-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-verified-careers-page-no-public-jobs-surface',
  extractionStrategy: 'verified-official-careers-page+no-public-jobs-signal+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'splashlearn/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SPLASHLEARN_CATALOG
