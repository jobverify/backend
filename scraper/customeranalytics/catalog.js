import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CUSTOMER_ANALYTICS_CATALOG = {
  source: 'customeranalytics',
  companyName: 'Customer Analytics',
  officialBrandName: 'Customer Analytics',
  adapter: 'script',
  homepageUrl: 'https://www.customeranalytics.com/',
  companyCareerPage: 'https://www.customeranalytics.com/company/careers',
  atsPlatform: 'official-company-careers-inline-opportunities',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-current-opportunity-cards+inline-detail-panels+onsite-office-location-cue',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'customeranalytics.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://www.customeranalytics.com/company/careers remained the first-party Customer Analytics careers page, rendered Current Opportunities as expandable job cards for MS Dynamics 365 F&O Functional Consultant and MS Dynamics 365 F&O Developer, and retained the India office location in Guindy, Chennai beneath the openings content.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.resolve(currentDir, 'jobs.json'),
}

export default CUSTOMER_ANALYTICS_CATALOG
