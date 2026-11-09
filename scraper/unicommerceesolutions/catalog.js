import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const UNICOMMERCE_ESOLUTIONS_CATALOG = {
  source: 'unicommerceesolutions',
  companyName: 'Unicommerce Esolutions',
  officialBrandName: 'Unicommerce',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'unicommerceesolutions/jobs.json',
  companyCareerPage: 'https://services.unicommerce.com/aboutus/careers',
  companyDomain: 'services.unicommerce.com',
  atsPlatform: 'official-first-party-static-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-current-openings-page',
  extractionStrategy:
    'verified-first-party-current-openings-page+inline-role-descriptions',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://services.unicommerce.com/aboutus/careers is the live first-party Unicommerce current openings page and that it publicly lists openings including Senior/Java Developer and Senior/User Interface Developer with inline qualifications, experience, and job descriptions. Because those role descriptions are embedded directly on the official first-party page, the local scraper extracts them from that single openings surface.',
}

export default UNICOMMERCE_ESOLUTIONS_CATALOG
