import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const UNTHINKABLE_SOLUTIONS_CATALOG = {
  source: 'unthinkablesolutions',
  companyName: 'Unthinkable Solutions',
  officialBrandName: 'Unthinkable Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.unthinkable.co/',
  companyCareerPage: 'https://www.unthinkable.co/career/',
  companyDomain: 'unthinkable.co',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-public-careers-shell',
  extractionStrategy: 'verified-careers-shell+open-vacancies-sentinel-without-public-role-links-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.unthinkable.co/career/ is the live first-party Unthinkable Solutions careers page and that it presents branded hiring copy such as "Open Vacancies" and "Build Your Career with Us". The public first-party HTML did not expose trustworthy structured vacancy cards or stable role detail links, so this local provider fails closed until Unthinkable publishes an exact public jobs list.',
  dryRunFile: 'unthinkablesolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default UNTHINKABLE_SOLUTIONS_CATALOG
