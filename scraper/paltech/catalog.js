import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PALTECH_CATALOG = {
  source: 'paltech',
  companyName: 'PalTech',
  officialBrandName: 'PalTech',
  adapter: 'script',
  homepageUrl: 'https://pal-tech.com/',
  companyCareerPage: 'https://pal-tech.com/careers/',
  companyDomain: 'pal-tech.com',
  atsPlatform: 'official-first-party-open-positions-page',
  countryFilter: 'Global',
  paginationStrategy: 'single-first-party-open-positions-section',
  extractionStrategy: 'verified-first-party-careers-page+open-positions-section-only+detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://pal-tech.com/careers/ was the live first-party PalTech careers surface, that the page exposed an Open Positions section with a public Business Analyst listing, and that the same page also contained hidden spam text reading "casino bonus fara depunere", so extraction is intentionally limited to the verified #open-positions section only.',
  dryRunFile: 'paltech/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PALTECH_CATALOG
