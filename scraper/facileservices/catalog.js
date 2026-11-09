import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FACILE_SERVICES_CATALOG = {
  source: 'facileservices',
  companyName: 'Facile Services',
  officialBrandName: 'Facile Services',
  adapter: 'script',
  homepageUrl: 'https://www.facileserv.com/',
  companyCareerPage: 'https://www.facileserv.com/careers/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-static-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+static-job-table-data-jdesc',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'facileserv.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.facileserv.com/careers/ remained the exact first-party Facile Services careers page and exposed a static Career Opportunities table with inline data-jdesc job descriptions for openings including Content Writer, Database Administrator, Programmatic Ads Specialist, and Voice and Accent Trainer in Pune, India.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FACILE_SERVICES_CATALOG
