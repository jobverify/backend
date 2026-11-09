import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VELANINFOSERVICES_CATALOG = {
  source: 'velaninfoservices',
  companyName: 'Velan Info Services',
  officialBrandName: 'Velan Info Services',
  adapter: 'script',
  homepageUrl: 'https://www.velaninfo.com/careers',
  companyCareerPage: 'https://www.velaninfo.com/jobs',
  atsPlatform: 'first-party-current-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-page',
  extractionStrategy: 'verified-job-sections+inline-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'velaninfo.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.velaninfo.com/jobs was the live first-party Velan Info Services current-openings page and that it publicly exposed inline job cards including Senior Accountant and Process Executive with first-party apply links, posted dates, experience requirements, and Coimbatore locations on the verified date.',
  dryRunFile: 'velaninfoservices/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default VELANINFOSERVICES_CATALOG
