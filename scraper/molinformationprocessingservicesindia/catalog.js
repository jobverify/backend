import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG = {
  source: 'molinformationprocessingservicesindia',
  companyName: 'Mol Information Processing Services India',
  officialBrandName: 'MOL-IT',
  adapter: 'script',
  homepageUrl: 'https://www.mol-it.com/',
  companyCareerPage: 'https://www.mol-it.com/careers/',
  officialCareersHandoffUrl: 'https://molit.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://molit.darwinbox.in',
  darwinboxCompanyId: 'main',
  companyDomain: 'mol-it.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page-button-handoff+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 3,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.mol-it.com/careers/ remained the official MOL-IT careers page, surfaced Careers at MOL-IT and Current Vacancies copy, and used an Explore button handoff to the public Darwinbox candidate portal at https://molit.darwinbox.in/ms/candidate/careers. A live Darwinbox browser-session scrape verified public India roles including Associate Manager - Project Delivery and Data Analyst.',
  dryRunFile: 'molinformationprocessingservicesindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG
