import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NORTHCORP_SOFTWARE_CATALOG = {
  source: 'northcorpsoftware',
  companyName: 'Northcorp Software',
  officialBrandName: 'Northcorp Software',
  adapter: 'script',
  homepageUrl: 'https://northcorpsoftware.com/',
  companyCareerPage: 'https://northcorpsoftware.com/career.html',
  companyDomain: 'northcorpsoftware.com',
  atsPlatform: 'official-company-careers-inline-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-inline-openings-table+verified-accordion-role-details+single-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://northcorpsoftware.com/career.html is the live first-party Northcorp Software careers page, that it exposes inline openings rows and matching accordion details for Creative & Technical Content Writer, Sr. UI / FRONTEND DEVELOPER, DevOps Engineer, and iOS Developer, and that candidates apply through the same-page Apply online for the position form.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'northcorpsoftware/jobs.json',
}

export default NORTHCORP_SOFTWARE_CATALOG
