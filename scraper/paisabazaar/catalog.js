import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PAISABAZAAR_CATALOG = {
  source: 'paisabazaar',
  companyName: 'Paisabazaar',
  officialBrandName: 'Paisabazaar.com',
  adapter: 'script',
  companyCareerPage: 'https://www.paisabazaar.com/careers',
  legalCin: 'U74900HR2011PTC044581',
  companyDomain: 'paisabazaar.com',
  atsPlatform: 'first-party-careers-page-email-intake',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-email-intake',
  extractionStrategy:
    'verified-first-party-careers-page+team-email-intake-without-public-role-pages-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.paisabazaar.com/careers is the live first-party Paisabazaar careers page. The verified page says We make personal finance easy, convenient & transparent, lists Technology Team, Product & Marketing Teams, and Operations Teams, and routes candidates to resume-intake mailboxes at careers+tech@paisabazaar.com, careers+product@paisabazaar.com, and careers+operations@paisabazaar.com. The same first-party surface also carries the company marker CIN No. U74900HR2011PTC044581. No trustworthy public role-detail pages or public ATS handoff were exposed on the verified careers surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PAISABAZAAR_CATALOG
