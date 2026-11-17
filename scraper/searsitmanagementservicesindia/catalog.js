import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG = {
  source: 'searsitmanagementservicesindia',
  companyName: 'Sears IT & Management Services India',
  officialBrandName: 'Sears Holdings India',
  adapter: 'script',
  homepageUrl: 'https://searsholdingsindia.in/',
  companyCareerPage: 'https://searsholdingsindia.in/careers/',
  companyDomain: 'searsholdingsindia.in',
  atsPlatform: 'current-own-careers-client-declared-openings-api-unavailable',
  countryFilter: 'India',
  paginationStrategy: 'own-current-root-careers-whole-inline-programme-and-exact-declared-openings-endpoint',
  extractionStrategy: 'whole-current-client-and-original-declared-api404-retained+no-location-tab-empty-inventory-assertion+role-country-employer-and-company-scope-unqualified',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://searsholdingsindia.in/careers/ is the live first-party Sears India careers page for the backlog row Sears IT & Management Services India. The page currently uses the title "Sears India Careers | Together, Let’s Commit to Excellence", exposes Current Openings tabs for Pune and Hyderabad plus hiring copy and a Job Disclaimer link, but the first-party HTML still does not provide trustworthy structured job titles or detail links that can be scraped exactly.',
  dryRunFile: 'searsitmanagementservicesindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG
