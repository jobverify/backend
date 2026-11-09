import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LOCOBUZZ_CATALOG = {
  source: 'locobuzz',
  companyName: 'Locobuzz',
  officialBrandName: 'Locobuzz',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'locobuzz/jobs.json',
  companyCareerPage: 'https://locobuzz.com/careers',
  companyDomain: 'locobuzz.com',
  atsPlatform: 'first-party-inline-careers-accordions',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-open-positions+mailto-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 13,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://locobuzz.com/careers is the live first-party Locobuzz careers page, that it exposes an Open Positions section with inline role cards, and that candidates are instructed to write to careers@locobuzz.com. The verified page publicly listed 13 openings including SDR with Mumbai / Delhi / Bangalore and Senior Python Developer with Mumbai, so this scraper parses the inline first-party cards and keeps India roles only.',
}

export default LOCOBUZZ_CATALOG
