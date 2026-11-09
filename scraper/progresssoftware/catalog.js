import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROGRESS_SOFTWARE_CATALOG = {
  source: 'progresssoftware',
  companyName: 'Progress Software',
  officialBrandName: 'Progress Software Corporation',
  adapter: 'script',
  homepageUrl: 'https://www.progress.com/company/careers',
  companyCareerPage: 'https://www.progress.com/company/careers/open-positions',
  officialCareersPageUrl: 'https://www.progress.com/company/careers/open-positions',
  jobPagePrefix: 'https://www.progress.com/company/careers/open-positions/',
  companyDomain: 'progress.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-open-positions-page-plus-first-party-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-homepage+verified-open-positions-list+india-location-filter+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-23',
  inventoryVerificationPolicy: 'live-parser-evidence-required',
  verifiedPublicJobCount: 26,
  verifiedIndiaJobCount: 10,
  verifiedSurfaceSummary:
    'Verified on 2026-10-23 that https://www.progress.com/company/careers links to https://www.progress.com/company/careers/open-positions. Each run reconciles all native SSR cards, ItemList URLs and per-country facet counts, then verifies all JobPosting detail identities, visible locations and employer content. The current board exposes 26 public roles, including 10 India roles. Native Jobvite IDs retain case; first-party detail redirects may canonicalize only route case/encoding. Explicit JobPosting dates are preserved; schema-only or heading-only descriptions remain missing visible details and yield incomplete inventory evidence.',
  dryRunFile: 'progresssoftware/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PROGRESS_SOFTWARE_CATALOG
