import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PEPPERFRY_CATALOG = {
  source: 'pepperfry',
  companyName: 'Pepperfry',
  officialBrandName: 'Pepperfry',
  adapter: 'script',
  homepageUrl: 'https://www.pepperfry.com/',
  companyCareerPage: 'https://www.pepperfry.com/pages/careers.html?type=footer',
  companyDomain: 'pepperfry.com',
  atsPlatform: 'first-party-careers-page+darwinbox-apply-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-homepage-footer-careers-link+verified-first-party-careers-listings+darwinbox-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.pepperfry.com/ is the live official Pepperfry homepage, that its footer careers entry points to https://www.pepperfry.com/pages/careers.html?type=footer, and that the first-party careers page currently renders a Current Openings section with live Darwinbox apply links on the exact-name Pepperfry surface.',
  dryRunFile: 'pepperfry/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PEPPERFRY_CATALOG
