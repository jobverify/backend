import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAVISSON_SYSTEMS_CATALOG = {
  source: 'cavissonsystems',
  companyName: 'Cavisson Systems',
  officialBrandName: 'Cavisson Systems',
  adapter: 'script',
  homepageUrl: 'https://www.cavisson.com/',
  companyCareerPage: 'https://www.cavisson.com/careers-at-cavisson/',
  openingsPageUrl: 'https://www.cavisson.com/category/open-position-india/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-openings-archive',
  extractionStrategy: 'verified-first-party-careers-page+verified-india-openings-archive',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cavisson.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.cavisson.com/careers-at-cavisson/ remained the first-party Cavisson careers page and that it linked to the live India openings archive at https://www.cavisson.com/category/open-position-india/, which publicly listed roles including Sr. Software Engineer, Product Management Professional, DevOps Engineer, Unix C Developer, and JAVA Developer on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cavissonsystems/jobs.json',
}

export default CAVISSON_SYSTEMS_CATALOG
