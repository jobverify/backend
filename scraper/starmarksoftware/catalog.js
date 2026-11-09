import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STARMARK_SOFTWARE_CATALOG = {
  source: 'starmarksoftware',
  companyName: 'Starmark Software',
  officialBrandName: 'Starmark Software',
  adapter: 'script',
  homepageUrl: 'https://www.starmarksv.com/',
  companyCareerPage: 'https://www.starmarksv.com/careers.html',
  companyDomain: 'starmarksv.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-public-careers-shell',
  extractionStrategy: 'verified-careers-shell+resume-handoff-without-public-role-cards-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.starmarksv.com/careers.html is the live first-party Starmark Software careers shell and that it now presents a "Join Our Team" recruiting page plus a resume handoff to careers@starmarksv.com, but the public first-party HTML still does not expose trustworthy structured role cards or detail pages that can be scraped exactly. This local provider therefore fails closed until Starmark publishes a public job list.',
  dryRunFile: 'starmarksoftware/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default STARMARK_SOFTWARE_CATALOG
