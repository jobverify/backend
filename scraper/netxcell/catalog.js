import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NETXCELL_CATALOG = {
  source: 'netxcell',
  companyName: 'Netxcell',
  officialBrandName: 'Netxcell Limited',
  adapter: 'script',
  companyCareerPage: 'https://www.netxcell.com/careers.php',
  detailPageUrls: [
    'https://www.netxcell.com/enterprise-sales-manager.php',
    'https://www.netxcell.com/arcallingexperience.php',
    'https://www.netxcell.com/business-development-mannager.php',
    'https://www.netxcell.com/linux-administrator.php',
  ],
  companyDomain: 'netxcell.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-page-listing-plus-first-party-detail-pages',
  extractionStrategy: 'verified-careers-page+first-party-detail-pages+same-page-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.netxcell.com/careers.php is the live first-party Netxcell careers page and that it publishes public opening cards with Apply links to first-party detail pages including https://www.netxcell.com/enterprise-sales-manager.php, https://www.netxcell.com/arcallingexperience.php, https://www.netxcell.com/business-development-mannager.php, and https://www.netxcell.com/linux-administrator.php. Verified that these detail pages remain on the first-party domain and expose role content plus an on-page application form. Netxcell should be integrated as a real first-party careers scraper rather than a sentinel.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NETXCELL_CATALOG
