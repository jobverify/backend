import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RAJA_SOFTWARE_LABS_CATALOG = {
  source: 'rajasoftwarelabs',
  companyName: 'Raja Software Labs',
  officialBrandName: 'RSL',
  adapter: 'script',
  companyCareerPage: 'https://rajasoftwarelabs.com/careers/current-openings',
  companyDomain: 'rajasoftwarelabs.com',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page-current-openings-list',
  extractionStrategy: 'verified-current-openings-shell+anchor-list-extraction+static-pune-location',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://rajasoftwarelabs.com/careers/current-openings was the live first-party Raja Software Labs careers page and that it listed three public openings directly on-page: Software Engineer – Android, Software Engineer – iOS, and Software Engineer – Web Frontend. The local scraper therefore parses the first-party current openings list directly and normalizes each role to the verified Pune, Maharashtra office.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'rajasoftwarelabs/jobs.json',
}

export default RAJA_SOFTWARE_LABS_CATALOG
