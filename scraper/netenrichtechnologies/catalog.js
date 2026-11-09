import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NETENRICH_TECHNOLOGIES_CATALOG = {
  source: 'netenrichtechnologies',
  companyName: 'Netenrich Technologies',
  officialBrandName: 'Netenrich',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://netenrich.com/careers',
  companyDomain: 'netenrich.com',
  atsPlatform: 'first-party-html-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-plus-first-party-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+html-open-positions+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'netenrichtechnologies/jobs.json',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://netenrich.com/careers is the live first-party Netenrich careers page and that it publicly exposes India openings such as Cloud Security Architect and Technical Content Writer, each linking to first-party detail pages on netenrich.com/careers/.',
}

export default NETENRICH_TECHNOLOGIES_CATALOG
