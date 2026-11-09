import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const QUALIZEAL_CATALOG = {
  source: 'qualizeal',
  companyName: 'QualiZeal',
  officialBrandName: 'QualiZeal',
  adapter: 'script',
  homepageUrl: 'https://qualizeal.com/',
  companyCareerPage: 'https://qualizeal.com/',
  companyDomain: 'qualizeal.com',
  atsPlatform: 'cloudflare-protected-company-site-no-public-jobs-inventory',
  countryFilter: 'India',
  paginationStrategy: 'single-company-site-challenge-sentinel',
  extractionStrategy:
    'cloudflare-challenge-detection+no-trustworthy-public-jobs-inventory+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://qualizeal.com/ resolved publicly to a JavaScript-required anti-bot page reading "Javascript is required. Please enable javascript before you are allowed to see this page." and exposed no trustworthy public jobs inventory, stable careers page, or attributable public job cards. This exact-name local provider therefore fails closed until QualiZeal publishes a first-party inventory that can be verified directly.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default QUALIZEAL_CATALOG
