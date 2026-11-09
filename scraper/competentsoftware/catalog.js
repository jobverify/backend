import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COMPETENT_SOFTWARE_CATALOG = {
  source: 'competentsoftware',
  companyName: 'Competent Software',
  officialBrandName: 'Competent Software',
  adapter: 'script',
  homepageUrl: 'https://competentsoftware.com/',
  companyCareerPage: 'https://competentsoftware.com/careers',
  companyDomain: 'competentsoftware.com',
  atsPlatform: 'first-party-careers-page-no-open-positions-note',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+explicit-no-open-positions-note+resume-form-fail-closed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://competentsoftware.com/careers is the exact-name Competent Software careers page, that it still advertises generic categories like Process Associate and Software Developer alongside the shared resume form, and that the authoritative note on the same page says "Currently there are no open positions" with a careers@competentsoftware.com fallback. This provider therefore stays fail-closed until a trustworthy public role inventory reappears.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'competentsoftware/jobs.json',
}

export default COMPETENT_SOFTWARE_CATALOG
