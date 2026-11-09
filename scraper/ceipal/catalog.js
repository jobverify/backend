import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CEIPAL_CATALOG = {
  source: 'ceipal',
  companyName: 'Ceipal',
  officialBrandName: 'CEIPAL',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'ceipal/jobs.json',
  companyCareerPage: 'https://www.ceipal.com/current-opening',
  officialCareersLandingUrl: 'https://www.ceipal.com/careers',
  companyDomain: 'ceipal.com',
  atsPlatform: 'first-party-current-opening-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-opening-page',
  extractionStrategy:
    'verified-first-party-current-opening-page+mailto-apply+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.ceipal.com/careers is the live first-party CEIPAL careers landing page and that its View Open Positions flow resolves to the first-party page at https://www.ceipal.com/current-opening. The verified page publicly showed "We\'re Hiring", listed the role Enterprise Business Development Representative with Location: Rochester, NY, and instructed candidates to submit resumes to apply@ceipal.com. The verified live page did not expose an India role on that date, so this scraper keeps the real first-party parser but returns only India matches.',
}

export default CEIPAL_CATALOG
