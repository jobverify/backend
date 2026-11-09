import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://magicpin.in/careers is the live exact-name first-party careers page for magicpin and that the page currently renders the empty-state combination "Find your next job at magicpin", "All open roles", and "No Jobs found" without publishing any trustworthy public job listings. There is no trustworthy public jobs surface on the exact-name Magicpin domain.'

export const MAGICPIN_CATALOG = {
  source: 'magicpin',
  companyName: 'Magicpin',
  officialBrandName: 'magicpin',
  adapter: 'script',
  homepageUrl: 'https://magicpin.in/',
  companyCareerPage: 'https://magicpin.in/careers',
  companyDomain: 'magicpin.in',
  atsPlatform: 'official-company-careers-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-empty-board-validation',
  extractionStrategy: 'verified-first-party-careers-page+verified-empty-open-roles-state-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'magicpin/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MAGICPIN_CATALOG
