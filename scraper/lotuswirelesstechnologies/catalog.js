import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LOTUS_WIRELESS_TECHNOLOGIES_CATALOG = {
  source: 'lotuswirelesstechnologies',
  companyName: 'Lotus Wireless Technologies',
  officialBrandName: 'Lotus Wireless Technologies India Pvt. Ltd.',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://lotuswireless.com/careers-page',
  companyDomain: 'lotuswireless.com',
  atsPlatform: 'official-first-party-careers-page-visible-opening-cards-with-email-apply',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-visible-opening-card-validation',
  extractionStrategy: 'verified-first-party-careers-page+visible-opening-card-extraction+mailto-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedPublicJobCount: 1,
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that https://lotuswireless.com/careers-page is Lotus Wireless Technologies\' live first-party careers page, that it currently publishes visible Current Openings cards on the page itself, and that it instructs candidates to apply via careers@lotuswireless.com. The verified public surface exposed one unique India opening during live review, so the scraper now extracts the visible first-party opening cards and uses the published careers email as the apply handoff.',
}

export default LOTUS_WIRELESS_TECHNOLOGIES_CATALOG
