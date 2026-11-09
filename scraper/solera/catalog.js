import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOLERA_CATALOG = {
  source: 'solera',
  companyName: 'Solera',
  officialBrandName: 'Solera',
  adapter: 'script',
  homepageUrl: 'https://www.solera.com/',
  companyCareerPage: 'https://www.solera.com/careers/',
  workdayTenantUrl: 'https://solera.wd5.myworkdayjobs.com/Global_Career_Site',
  companyDomain: 'solera.com',
  atsPlatform: 'first-party-careers-page-linking-to-workday-without-inline-inventory',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-workday-link-sentinel',
  extractionStrategy:
    'first-party-careers-copy+workday-link-detection+no-inline-job-inventory+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.solera.com/careers/ was Solera\'s live first-party careers page, that it exposed the headline "Revving Up For Growth" plus a "See Open Positions" link to a Workday tenant, and that the first-party page itself did not publish a trustworthy inline jobs inventory or attributable public job cards. This exact-name local provider therefore fails closed on the verified first-party page contract rather than scraping the Workday tenant through shared registries.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SOLERA_CATALOG
