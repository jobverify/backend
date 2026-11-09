import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AVANZE_TECHNOLOGIES_CATALOG = {
  source: 'avanzetechnologies',
  companyName: 'Avanze Technologies',
  officialBrandName: 'Avanze Group',
  adapter: 'script',
  homepageUrl: 'https://www.avanzegroup.com/',
  companyCareerPage: 'https://www.avanzegroup.com/career.php',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-contact-handoff-return-empty',
  extractionStrategy: 'verified-careers-page+contact-handoff-button+no-trustworthy-public-openings-list',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'avanzegroup.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.avanzegroup.com/career.php was the live first-party Avanze careers page, but its visible "current openings" call-to-action still routed to contact.php while the prior career-subpage link remained commented out, leaving no trustworthy public openings list on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'avanzetechnologies/jobs.json',
}

export default AVANZE_TECHNOLOGIES_CATALOG
