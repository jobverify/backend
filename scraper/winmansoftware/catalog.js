import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const WINMAN_SOFTWARE_CATALOG = {
  source: 'winmansoftware',
  companyName: 'Winman Software',
  officialBrandName: 'Winman Software',
  adapter: 'script',
  homepageUrl: 'https://www.winmansoftware.com/',
  companyCareerPage: 'https://www.winmansoftware.com/more/careers/',
  applyUrl: 'https://winman.in/jobs/resume.aspx',
  atsPlatform: 'official-first-party-html-table',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'first-party-freshers-and-experienced-tables+fresher-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'winmansoftware.com',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the old experienced careers URL redirects in browser to https://www.winmansoftware.com/more/careers/. The current first-party page lists 14 fresher roles with individual detail pages and eight experienced roles in its public table, and links applicants to https://winman.in/jobs/resume.aspx.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default WINMAN_SOFTWARE_CATALOG
