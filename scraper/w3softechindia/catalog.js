import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const W3SOFTECH_INDIA_CATALOG = {
  source: 'w3softechindia',
  companyName: 'W3Softech India',
  officialBrandName: 'W3Softech India Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://w3softech.com/',
  companyCareerPage: 'https://w3softech.com/career',
  atsPlatform: 'official-company-site-html-jobs-table',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'html-jobs-table',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'w3softech.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://w3softech.com/career was the live first-party W3Softech India careers page, that it exposed a public HTML jobs table with Apply actions, and that the table listed roles including Python Developer and MuleSoft Developer in Hyderabad.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default W3SOFTECH_INDIA_CATALOG
