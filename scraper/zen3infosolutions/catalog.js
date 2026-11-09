import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ZEN3_INFO_SOLUTIONS_CATALOG = {
  source: 'zen3infosolutions',
  companyName: 'Zen3 Info Solutions',
  officialBrandName: 'zen3',
  adapter: 'script',
  companyCareerPage: 'https://zen3.com/',
  companyDomain: 'zen3.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-missing-first-party-careers-routes',
  extractionStrategy: 'verified-homepage+verified-missing-careers-routes+no-public-job-signals',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://zen3.com/ is the live first-party zen3 homepage showing business and location content including hyderabad, india, but there is still no trustworthy public jobs surface on the official domain and common first-party careers routes remain absent.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'zen3infosolutions/jobs.json',
}

export default ZEN3_INFO_SOLUTIONS_CATALOG
