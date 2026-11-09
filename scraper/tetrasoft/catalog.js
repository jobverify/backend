import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TETRASOFT_CATALOG = {
  source: 'tetrasoft',
  companyName: 'TetraSoft',
  officialBrandName: 'Tetrasoft India Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.tetrasoft.us/',
  companyCareerPage: 'https://www.tetrasoft.us/careers.html',
  companyDomain: 'tetrasoft.us',
  atsPlatform: 'official-company-careers-html',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-accordion+mailto-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.tetrasoft.us/careers.html is the live first-party Tetrasoft Careers page and that it publicly exposes accordion-style role cards such as Tech Lead - Machine Learning with Python, Tech Lead - ReactJS, and Tech Lead - Python. Each role uses the same first-party mailto apply contract, ts_tag_offshore@tetrasoft.us, so this scraper is pinned to the verified first-party careers accordion plus the same-domain mailto handoff.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default TETRASOFT_CATALOG
