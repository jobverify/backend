import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHIPCO_IT_CATALOG = {
  source: 'shipcoit',
  companyName: 'Shipco It',
  officialBrandName: 'Shipco Transport',
  adapter: 'script',
  homepageUrl: 'https://www.shipco.com/',
  companyCareerPage: 'https://www.shipco.com/career',
  companyDomain: 'shipco.com',
  atsPlatform: 'first-party-careers-shell-with-client-rendered-search-form',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-shell-no-server-rendered-openings',
  extractionStrategy:
    'verified-first-party-careers-shell+search-form-without-server-rendered-openings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.shipco.com/career was the live first-party Shipco careers shell, that it rendered the Apply for a job search form with Title Office Job Type Date Of Publishing Description controls, and that there was no server-rendered public inventory in the verified response. This provider stays fail-closed until Shipco exposes an enumerable public jobs list.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SHIPCO_IT_CATALOG
