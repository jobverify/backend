import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CADSYS_CATALOG = {
  source: 'cadsys',
  companyName: 'Cadsys',
  officialBrandName: 'Cadensys',
  adapter: 'script',
  homepageUrl: 'https://www.cadensys.ai/',
  companyCareerPage: 'https://www.cadensys.ai/careers/',
  atsPlatform: 'official-static-careers-page',
  countryFilter: 'Global',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-role-links+same-domain-detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cadensys.ai',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.cadensys.ai/careers/ was the live first-party Cadensys careers page and that it publicly listed Senior Data Scientist, Software Engineer, Backend, and Software Engineer, Frontend as same-domain role links, each labeled Remote / Hybrid.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cadsys/jobs.json',
}

export default CADSYS_CATALOG
