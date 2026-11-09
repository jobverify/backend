import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FACTSPAN_CATALOG = {
  source: 'factspan',
  companyName: 'Factspan',
  officialBrandName: 'Factspan',
  adapter: 'script',
  homepageUrl: 'https://www.factspan.com/',
  companyCareerPage: 'https://www.factspan.com/current-opening-jobs/',
  parentCareersPageUrl: 'https://www.factspan.com/careers/',
  companyDomain: 'factspan.com',
  atsPlatform: 'first-party-current-openings-page-without-public-openings-list',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-sentinel',
  extractionStrategy: 'current-openings-page-detection+no-public-openings-list+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.factspan.com/current-opening-jobs/ was Factspan\'s current-openings destination linked from the first-party careers page, that it exposed the "Current Openings" heading and contact@factspan.com, and that the public page shell does not publish a trustworthy machine-readable openings list or attributable public job cards. This exact-name local provider therefore fails closed until Factspan exposes a real first-party inventory.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FACTSPAN_CATALOG
