import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GIRMITI_SOFTWARE_CATALOG = {
  source: 'girmitisoftware',
  companyName: 'Girmiti Software',
  officialBrandName: 'Girmiti Software',
  adapter: 'script',
  homepageUrl: 'https://www.girmiti.com/',
  companyCareerPage: 'https://www.girmiti.com/current_openings.html',
  companyDomain: 'girmiti.com',
  atsPlatform: 'official-first-party-current-openings-page',
  countryFilter: 'Global',
  paginationStrategy: 'single-current-openings-page',
  extractionStrategy: 'verified-first-party-current-openings-page+inline-role-blocks',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.girmiti.com/current_openings.html was the live first-party Girmiti Software current openings page and that it publicly exposed inline role blocks, including GJ-00A001 and GJ-00A006, with the application mailbox careers@girmiti.com on the verified date.',
  dryRunFile: 'girmitisoftware/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GIRMITI_SOFTWARE_CATALOG
