import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SANOFI_CATALOG = {
  source: 'sanofi',
  companyName: 'Sanofi',
  officialBrandName: 'Sanofi',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sanofi/jobs.json',
  companyCareerPage: 'https://jobs.sanofi.com/en/india',
  companyDomain: 'jobs.sanofi.com',
  atsPlatform: 'radancy',
  countryFilter: 'India',
  paginationStrategy: 'country-search-path-segment-pagination',
  extractionStrategy: 'verified-first-party-india-page+verified-country-search-pages+detail-jsonld',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://jobs.sanofi.com/en/india was the live first-party Sanofi India careers page, that it linked applicants to the first-party India search surface at https://jobs.sanofi.com/en/search-jobs/india/20873/1/1, and that the verified India search results exposed 107 public India jobs across 8 pages. Verified page-1 public roles included SE Asia & India MCO Rare Disease Medical Lead in Mumbai, EBI Business Partner in Mumbai, and Principal Statistical Programmer in Hyderabad on the verified date.',
}

export default SANOFI_CATALOG
