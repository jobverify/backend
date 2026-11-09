import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CI_INFOTECH_CATALOG = {
  source: 'ciinfotech',
  companyName: 'CI Infotech',
  officialBrandName: 'CI Infotech Pvt. Ltd.',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://ciinfotech.net/current-openings/',
  companyDomain: 'ciinfotech.net',
  atsPlatform: 'first-party-current-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-openings-page',
  extractionStrategy: 'first-party-html-opening-cards+detail-link-extraction',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://ciinfotech.net/current-openings/ is CI Infotech\'s live first-party openings page and that the public HTML exposes repeated opening cards with job titles, posting dates, locations, job types, and details links that can be scraped directly from the first-party surface.',
}

export default CI_INFOTECH_CATALOG
