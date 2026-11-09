import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRAWEX_TECHNOLOGIES_CATALOG = {
  source: 'trawextechnologies',
  companyName: 'Trawex Technologies',
  officialBrandName: 'Trawex Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.trawex.com/',
  companyCareerPage: 'https://www.trawex.com/careers.php',
  sampleRoleUrl: 'https://www.trawex.com/senior-angular-developer.php',
  sampleBusinessRoleUrl: 'https://www.trawex.com/business-development-manager.php',
  atsPlatform: 'official-first-party-role-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'same-domain-listing-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'trawex.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.trawex.com/careers.php was the live first-party Trawex Technologies careers page, that it exposed a Current Openings section with same-domain role pages including https://www.trawex.com/senior-angular-developer.php and https://www.trawex.com/business-development-manager.php, and that the page publicly listed roles including Senior Angular Developer and Business Development Manager.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TRAWEX_TECHNOLOGIES_CATALOG
