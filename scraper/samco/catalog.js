import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.samco.in/ remains the live official Samco homepage, ' +
  'that it links Careers to https://www.samco.in/careers, and that the first-party careers page ' +
  'publishes four public openings branded as Samco: Channel Sales, Engineering, Growth, and Operations. ' +
  'The role cards and application form options expose matching position IDs and titles.'

export const SAMCO_CATALOG = {
  source: 'samco',
  companyName: 'Samco',
  officialBrandName: 'SAMCO Securities Limited',
  adapter: 'script',
  dryRunFile: 'samco/jobs.json',
  homepageUrl: 'https://www.samco.in/',
  companyCareerPage: 'https://www.samco.in/careers',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-public-department-options',
  extractionStrategy: 'verified-samco-homepage+verified-first-party-careers-page+public-position-select+matching-inline-apply-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'samco.in',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default SAMCO_CATALOG
