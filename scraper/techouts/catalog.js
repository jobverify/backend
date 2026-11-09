import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://techouts.com/careers was the live first-party Techouts careers page, that it embedded the public Keka board identifier 3ba5a10f-a9f3-413c-9853-0c55d1e34587, and that the associated active payload exposed Hyderabad openings including Data Engineer and Software Engineer-Machine Learning.'

export const TECHOUTS_CATALOG = {
  source: 'techouts',
  companyName: 'Techouts',
  officialBrandName: 'Techouts',
  adapter: 'script',
  homepageUrl: 'https://techouts.com/',
  companyCareerPage: 'https://techouts.com/careers',
  jobsApiUrl: 'https://techouts.keka.com/careers/api/embedjobs/default/active/3ba5a10f-a9f3-413c-9853-0c55d1e34587',
  companyDomain: 'techouts.com',
  atsPlatform: 'keka-embedjobs',
  countryFilter: 'India',
  paginationStrategy: 'single-keka-embed-payload',
  extractionStrategy: 'verified-first-party-careers-page+keka-embedjobs-active-payload+hyderabad-job-locations',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'techouts/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TECHOUTS_CATALOG
