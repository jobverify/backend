import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG = {
  source: 'cybertechsystemsandsoftware',
  companyName: 'Cybertech Systems & Software',
  officialBrandName: 'CyberTech',
  adapter: 'script',
  homepageUrl: 'https://cybertech.com/',
  companyCareerPage: 'https://cybertech.com/careers/',
  atsPlatform: 'first-party-careers-card-grid',
  countryFilter: 'Global',
  paginationStrategy: 'single-first-party-careers-card-grid',
  extractionStrategy: 'verified-careers-card-grid+card-level-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cybertech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://cybertech.com/careers/ was the live first-party CyberTech careers page and exposed public job cards for Lead Public Cloud DevOps Automation Specialist, Sr.DBA (MSSQL), and SAP ABAP Developer with visible experience metadata and Full Time labels. The first-party detail pages were JS-heavy shells during direct fetches, so this local parser stays anchored to the trustworthy card grid.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG
