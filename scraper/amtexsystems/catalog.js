import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMTEX_SYSTEMS_CATALOG = {
  source: 'amtexsystems',
  companyName: 'Amtex Systems',
  officialBrandName: 'Amtex Systems',
  adapter: 'script',
  homepageUrl: 'https://www.amtexsystems.com/',
  companyCareerPage: 'https://www.amtexsystems.com/careers',
  companyDomain: 'amtexsystems.com',
  atsPlatform: 'first-party-careers-page-plus-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-real-and-placeholder-cards',
  extractionStrategy:
    'verified-careers-shell+real-detail-links+placeholder-cards+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.amtexsystems.com/careers was the live exact-name Amtex careers page, that its visible card rail exposed one real first-party detail route at /career-list/business-analyst plus additional href="#" placeholders, and that the live detail page rendered Apply for Business Intelligence Analyst/Developer with the subtitle Join our team in New York, NY. The first-party surface is trustworthy but the verified public detail did not represent an India opening, so this local scraper currently filters to no India jobs.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'amtexsystems/jobs.json',
}

export default AMTEX_SYSTEMS_CATALOG
