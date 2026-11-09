import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SWIPEWIRE_TECHNOLOGIES_CATALOG = {
  source: 'swipewiretechnologies',
  companyName: 'Swipewire Technologies',
  officialBrandName: 'Swipe Wire',
  adapter: 'script',
  companyCareerPage: 'https://swipe-wire.com/career.html',
  contactEmail: 'info@swipe-wire.com',
  atsPlatform: 'first-party-careers-page-no-structured-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+future-projects-email-only-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'swipe-wire.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://swipe-wire.com/career.html was the live first-party Swipe Wire careers page for the backlog company Swipewire Technologies and that it asked candidates to send portfolios to info@swipe-wire.com for future projects, but exposed no structured public job listings.',
  dryRunFile: 'swipewiretechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SWIPEWIRE_TECHNOLOGIES_CATALOG
