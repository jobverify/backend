import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MANTHAN_CATALOG = {
  source: 'manthan',
  companyName: 'Manthan',
  officialBrandName: 'Manthan',
  adapter: 'script',
  companyCareerPage: 'https://manthan.com/careers/',
  companyDomain: 'manthan.com',
  officialHomepageUrl: 'https://manthan.com/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-inline-opening-blocks',
  extractionStrategy: 'verified-first-party-careers-page+inline-opening-blocks+linkedin-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://manthan.com/careers/ is the official first-party careers page for Manthan and currently exposes two concrete public openings for Bangalore, India with LinkedIn apply links. The same page also contains generic contact-page apply calls to action, so this scraper conservatively extracts only the two concrete public openings that link to public LinkedIn job pages.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MANTHAN_CATALOG
