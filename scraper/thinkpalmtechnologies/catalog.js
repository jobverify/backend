import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const THINKPALM_TECHNOLOGIES_CATALOG = {
  source: 'thinkpalmtechnologies',
  companyName: 'ThinkPalm Technologies',
  officialBrandName: 'ThinkPalm',
  adapter: 'script',
  homepageUrl: 'https://thinkpalm.com/',
  companyCareerPage: 'https://thinkpalm.com/company/careers/',
  atsPlatform: 'official-first-party-open-positions',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'inline-open-position-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'thinkpalm.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://thinkpalm.com/company/careers/ is the live first-party ThinkPalm careers page and that it publicly exposes inline open positions including DotNet Architect - 10+ Years in Cochin, Java Tech Lead - 7+ Years in Trivandrum, and Lead Cloud Engineer - 6+ Years in Trivandrum.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default THINKPALM_TECHNOLOGIES_CATALOG
