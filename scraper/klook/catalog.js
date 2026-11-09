import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KLOOK_CATALOG = {
  source: 'klook',
  companyName: 'Klook',
  officialBrandName: 'Klook',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'klook/jobs.json',
  companyCareerPage: 'https://www.klook.com/careers/',
  jobsSearchUrl: 'https://www.klookcareers.com/jobs/search?page=1',
  companyDomain: 'klook.com',
  atsPlatform: 'moka-login-gated-public-search',
  countryFilter: 'India',
  paginationStrategy: 'verified-login-gated-search-fail-closed',
  extractionStrategy: 'official-careers-page+official-moka-login-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.klook.com/careers/ is Klook\'s live first-party careers page and directs candidates to the official Klook careers search at https://www.klookcareers.com/jobs/search?page=1. A direct request to that official jobs URL redirected to the Moka login page rather than exposing enumerable public listings, so this provider fails closed until the first-party surface becomes publicly enumerable.',
}

export default KLOOK_CATALOG
