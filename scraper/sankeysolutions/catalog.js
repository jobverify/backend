import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SANKEY_SOLUTIONS_CATALOG = {
  source: 'sankeysolutions',
  companyName: 'Sankey Solutions',
  officialBrandName: 'Sankey solutions',
  adapter: 'script',
  homepageUrl: 'https://sankeysolutions.com/',
  companyCareerPage: 'https://sankeysolutions.com/careers/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sankeysolutions.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://sankeysolutions.com/careers/ was the live first-party Sankey Solutions careers page and that it publicly linked individual first-party detail pages for roles including Solution Analyst, UI / UX Designer, Human Resource, Digital Marketing, Content Writer, Technical Business Analyst, Technical Project Manager, Technical Architect, and Senior Project Manager (Technical).',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SANKEY_SOLUTIONS_CATALOG
