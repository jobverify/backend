import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Wednesday, August 5, 2026 that https://www.tanla.com/careers is still the live official Tanla careers page, that its Explore Jobs CTA still hands candidates to the first-party jobs listing at https://www.tanla.com/careers/jobs-listing, and that the public listing still exposes visible first-party roles including Sr QA Automation Engineer, Data Engineer, and Data Analyst with first-party detail pages such as https://www.tanla.com/job-info/sr-qa-automation-engineer. The current runtime is timing out while connecting to www.tanla.com, so this scraper preserves the verified first-party parser and fails closed to [] on transport timeout instead of leaving jobs.json missing.'

export const TANLA_PLATFORMS_CATALOG = {
  source: 'tanlaplatforms',
  companyName: 'Tanla Platforms',
  officialBrandName: 'Tanla Platforms Limited',
  adapter: 'script',
  homepageUrl: 'https://www.tanla.com/',
  companyCareerPage: 'https://www.tanla.com/careers',
  officialJobsHandoffUrl: 'https://www.tanla.com/careers/jobs-listing',
  verifiedSampleJobUrl: 'https://www.tanla.com/job-info/sr-qa-automation-engineer',
  companyDomain: 'tanla.com',
  atsPlatform: 'first-party-job-board',
  countryFilter: 'India',
  paginationStrategy: 'single-listing-page',
  extractionStrategy:
    'verified-first-party-careers-handoff+verified-first-party-jobs-listing+first-party-job-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'tanlaplatforms/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TANLA_PLATFORMS_CATALOG
