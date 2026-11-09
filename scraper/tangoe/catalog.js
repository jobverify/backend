import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TANGOE_CATALOG = {
  source: 'tangoe',
  companyName: 'Tangoe',
  officialBrandName: 'Tangoe',
  adapter: 'script',
  homepageUrl: 'https://www.tangoe.com/',
  companyCareerPage: 'https://www.tangoe.com/careers/',
  careersVendorHost: 'workforcenow.adp.com',
  companyDomain: 'tangoe.com',
  atsPlatform: 'first-party-careers-page-plus-opaque-adp-handoff',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-only',
  extractionStrategy:
    'verified-first-party-careers-page+opaque-adp-search-handoff+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.tangoe.com/careers/ was the live first-party Tangoe careers page, that it marketed "Join Our Innovative Global Team" and exposed Search Careers CTAs pointing to workforcenow.adp.com, and that there was no trustworthy public jobs inventory or server-rendered role list on the verified first-party page. This provider stays fail-closed until Tangoe exposes an enumerable public board.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TANGOE_CATALOG
