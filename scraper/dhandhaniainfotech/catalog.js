import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DHANDHANIA_INFOTECH_CATALOG = {
  source: 'dhandhaniainfotech',
  companyName: 'Dhandhania Infotech',
  officialBrandName: 'DhanInfo',
  adapter: 'script',
  companyCareerPage: 'https://dhaninfo.com/career/',
  companyDomain: 'dhaninfo.com',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-accordion',
  extractionStrategy: 'verified-careers-page+accordion-job-sections+first-party-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that Dhandhania Infotech used the first-party DhanInfo careers page at https://dhaninfo.com/career/, and that page exposed public accordion sections for General Manager Operations, Senior Business Development Manager, Quality Assistant Manager (AM), and Accounts Payable/Accounts Receivable Executive (US Accounting) Night shift.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default DHANDHANIA_INFOTECH_CATALOG
