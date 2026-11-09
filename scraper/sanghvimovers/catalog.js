import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SANGHVI_MOVERS_CATALOG = {
  source: 'sanghvimovers',
  companyName: 'Sanghvi Movers',
  officialBrandName: 'Sanghvi Movers Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://sanghvicranes.com/',
  companyCareerPage: 'https://sanghvicranes.com/careers/',
  officialJobBoardUrl: 'https://sanghvicranes.com/careers/',
  atsPlatform: 'official-company-careers-static-html',
  countryFilter: 'India',
  paginationStrategy: 'single-static-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+static-job-sections+india-normalization',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sanghvicranes.com',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://sanghvicranes.com/careers/ is still the live first-party Sanghvi Movers Limited careers page, that it exposes a public Join Our Team section on the company domain with Apply Now job cards, and that current public listings include Lead Engineers Civil (Solar), Area Operations Manager, and WTG Installation Engineer.',
  dryRunFile: 'sanghvimovers/jobs.json',
}

export default SANGHVI_MOVERS_CATALOG
