import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GREYTRIX_CATALOG = {
  source: 'greytrix',
  companyName: 'Greytrix',
  officialBrandName: 'Greytrix',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.greytrix.com/careers/',
  companyDomain: 'greytrix.com',
  atsPlatform: 'official-careers-page-embedded-jobs-shell-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-embedded-shell-sentinel',
  extractionStrategy:
    'verified-first-party-careers-copy+embedded-jobs-shell-detection+no-public-job-cards+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.greytrix.com/careers/ is Greytrix\'s live first-party careers page and that the public HTML currently exposes branded recruiting copy, a fake-offer warning, a job-openings iframe shell, and a contact form, but not a trustworthy first-party public job-card inventory or machine-readable openings feed. The local scraper therefore fails closed until Greytrix publishes a stable first-party jobs surface.',
}

export default GREYTRIX_CATALOG
