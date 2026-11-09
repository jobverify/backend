import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG = {
  source: 'sapphiresoftwaresolutionsindia',
  companyName: 'Sapphire Software Solutions (India)',
  officialBrandName: 'Sapphire Software Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.sapphiresolutions.net/',
  companyCareerPage: 'https://www.sapphiresolutions.net/careers?tab=CurrentOpenings',
  atsPlatform: 'official-company-site-current-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'html-current-openings-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sapphiresolutions.net',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sapphiresolutions.net/careers?tab=CurrentOpenings was the live first-party Sapphire Software Solutions current openings page and that it exposed roles including Business Development Executive and Senior HR Executive in Ahmedabad.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SAPPHIRE_SOFTWARE_SOLUTIONS_INDIA_CATALOG
