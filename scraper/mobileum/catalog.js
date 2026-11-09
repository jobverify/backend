import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOBILEUM_CATALOG = {
  source: 'mobileum',
  companyName: 'Mobileum',
  officialBrandName: 'Mobileum',
  adapter: 'script',
  homepageUrl: 'https://www.mobileum.com/',
  companyCareerPage: 'https://www.mobileum.com/about/careers-and-culture',
  recruitPageUrl: 'https://mobileum-node.my.salesforce-sites.com/Recruit/',
  companyDomain: 'mobileum.com',
  atsPlatform: 'salesforce-applicant-portal',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-salesforce-vacancies-table',
  extractionStrategy:
    'verified-first-party-careers-iframe+official-salesforce-vacancies-table+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.mobileum.com/about/careers-and-culture is the first-party Mobileum careers page and that its Job Opportunities section embeds the official Salesforce applicant portal at https://mobileum-node.my.salesforce-sites.com/Recruit/. The verified applicant portal exposed a public Current Vacancies table, but the visible roles were non-India vacancies such as Senior Director - Technical Delivery in Seattle and Technical Delivery Manager in Portugal/Greece. This local provider therefore uses the official public vacancies table while keeping the exact-name India filter, which currently yields zero jobs.',
  dryRunFile: 'mobileum/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MOBILEUM_CATALOG
