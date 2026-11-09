import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RAILWAY_CATALOG = {
  source: 'railway',
  companyName: 'Railway',
  officialBrandName: 'Railway',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'railway/jobs.json',
  companyCareerPage: 'https://railway.com/careers',
  companyDomain: 'railway.com',
  atsPlatform: 'official-first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-current-global-remote-slice',
  extractionStrategy: 'verified-first-party-careers-page+same-domain-role-links+return-empty-when-no-india-locations',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedPublicJobCount: 16,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://railway.com/careers remained the live first-party Railway careers page, prominently stated "Redefine the future of infrastructure", and exposed 16 unique same-domain role pages including Senior Infra Engineer: Platform, Senior Infra Engineer: Observability, and Senior Infra Engineer: Datacenters. Every listing used the "Remote (anywhere)" location label, with zero India locations explicitly identified on the page.',
}

export default RAILWAY_CATALOG
