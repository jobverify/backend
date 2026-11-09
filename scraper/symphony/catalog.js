import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SYMPHONY_CATALOG = {
  source: 'symphony',
  companyName: 'Symphony',
  officialBrandName: 'Symphony Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'symphony/jobs.json',
  companyCareerPage: 'https://symphonylimited.com/careers/current-openings/',
  officialCareersPageUrl: 'https://symphonylimited.com/careers/current-openings/',
  officialCareersLandingUrl: 'https://symphonylimited.com/careers/',
  companyDomain: 'symphonylimited.com',
  atsPlatform: 'official-careers-page-no-current-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-verified-careers-page-no-openings-sentinel',
  extractionStrategy: 'verified-careers-page+no-openings-banner+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://symphonylimited.com/careers/current-openings/ is still the live first-party Symphony Limited careers page and that it explicitly says "There are no current openings. Please check this space later." There is no trustworthy public jobs list for the exact-name Symphony row on the verified page, so this provider fails closed and returns no jobs until Symphony publishes a stable public openings surface.',
}

export default SYMPHONY_CATALOG
