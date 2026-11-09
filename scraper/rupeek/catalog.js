import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RUPEEK_CATALOG = {
  source: 'rupeek',
  companyName: 'Rupeek',
  officialBrandName: 'Rupeek',
  adapter: 'script',
  companyCareerPage: 'https://rupeek.com/careers',
  officialCareersPageUrl: 'https://rupeek.com/about/careers',
  officialCareersCanonicalUrl: 'https://rupeek.com/careers',
  companyDomain: 'rupeek.com',
  atsPlatform: 'linkedin-company-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+html-job-cards+linkedin-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://rupeek.com/about/careers was the live first-party Rupeek careers surface, that the same page declared canonical https://rupeek.com/careers, and that the verified page exposed an Open Positions section with public LinkedIn apply links for live roles including Assistant Manager - Taxation and Back Office Executive.',
  dryRunFile: 'rupeek/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RUPEEK_CATALOG
