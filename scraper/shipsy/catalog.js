import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHIPSY_CATALOG = {
  source: 'shipsy',
  companyName: 'Shipsy',
  officialBrandName: 'Shipsy',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'shipsy/jobs.json',
  companyCareerPage: 'https://www.shipsy.ai/careers',
  officialCareersPageUrl: 'https://www.shipsy.ai/careers',
  companyDomain: 'www.shipsy.ai',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-role-links+same-domain-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.shipsy.ai/careers is the live first-party Shipsy careers page and that it publicly exposes current role links under the same domain including Director, Engineering and Software Engineer, Core Platform, with same-domain detail pages and application forms under https://www.shipsy.ai/careers/.',
}

export default SHIPSY_CATALOG
