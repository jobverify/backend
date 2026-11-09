import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const WEBTEL_ELECTROSOFT_CATALOG = {
  source: 'webtelelectrosoft',
  companyName: 'Webtel Electrosoft',
  officialBrandName: 'Webtel Electrosoft Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://webtel.in/careers',
  companyDomain: 'webtel.in',
  atsPlatform: 'official-careers-page-no-public-job-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-sentinel',
  extractionStrategy: 'verified-first-party-careers-copy+no-public-openings-detection+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://webtel.in/careers is Webtel Electrosoft\'s live first-party careers page, but the public page currently exposes employer-branding copy only and does not publish a trustworthy machine-readable jobs inventory or stable public job cards. The local scraper therefore fails closed and returns no jobs until Webtel exposes a real public openings feed.',
}

export default WEBTEL_ELECTROSOFT_CATALOG
