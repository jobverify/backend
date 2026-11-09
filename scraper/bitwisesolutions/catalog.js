import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BITWISE_SOLUTIONS_CATALOG = {
  source: 'bitwisesolutions',
  companyName: 'Bitwise Solutions',
  officialBrandName: 'Bitwise',
  adapter: 'script',
  homepageUrl: 'https://www.bitwiseglobal.com/',
  companyCareerPage: 'https://www.bitwiseglobal.com/company/careers',
  openingsPageUrl: 'https://www.bitwiseglobal.com/company/careers/openings',
  companyDomain: 'bitwiseglobal.com',
  atsPlatform: 'first-party-current-openings-page-no-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-current-openings-page',
  extractionStrategy:
    'verified-first-party-careers-page+current-openings-page-explicitly-no-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.bitwiseglobal.com/company/careers is the Bitwise first-party careers page for the backlog row Bitwise Solutions, that its View Open Positions CTA points to https://www.bitwiseglobal.com/company/careers/openings, and that the current openings page explicitly says "No openings found." This local provider therefore returns a trustworthy zero-openings result rather than leaving the company unhandled.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'bitwisesolutions/jobs.json',
}

export default BITWISE_SOLUTIONS_CATALOG
