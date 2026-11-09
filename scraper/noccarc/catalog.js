import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NOCCARC_CATALOG = {
  source: 'noccarc',
  companyName: 'Noccarc',
  officialBrandName: 'Noccarc Robotics Pvt Ltd',
  adapter: 'script',
  companyCareerPage: 'https://www.noccarc.com/careers',
  publicJobListingHost: 'noccarc.com',
  applicationUrl: 'mailto:careers@noccarc.com?subject=Apply%20for%20Job%20at%20Noccarc',
  companyDomain: 'noccarc.com',
  atsPlatform: 'official-company-careers-email-apply',
  countryFilter: 'India',
  paginationStrategy: 'single-page-first-party-inline-role-cards',
  extractionStrategy: 'verified-first-party-careers-page+same-page-inline-role-cards+shared-email-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.noccarc.com/careers is the live first-party Noccarc careers page, that it publicly lists six inline openings on the same page including Regional Sales Manager - South, Clinical Application Specialist- South, Senior Systems Engineer, Territory Sales Manager, Field Service Engineer, and UI/UX Designer, and that the current shared public apply handoff is mailto:careers@noccarc.com?subject=Apply%20for%20Job%20at%20Noccarc rather than the older outbound Naukri deep links.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NOCCARC_CATALOG
