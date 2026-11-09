import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CONTUS_CATALOG = {
  source: 'contus',
  companyName: 'Contus',
  officialBrandName: 'CONTUS TECH',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.contus.com/careers.php',
  companyDomain: 'contus.com',
  atsPlatform: 'first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-openings-list',
  extractionStrategy: 'first-party-current-openings-accordion+company-role-detail-link-extraction',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://www.contus.com/careers.php is CONTUS TECH\'s live first-party careers page and that the public HTML exposes a Current Openings accordion with active role titles, Chennai locations, and Apply Now links to company-hosted PHP role detail pages.',
}

export default CONTUS_CATALOG
