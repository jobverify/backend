import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MMC_INFOTECH_SERVICES_CATALOG = {
  source: 'mmcinfotechservices',
  companyName: 'MMC Infotech Services',
  officialBrandName: 'MMC Infotech Services',
  adapter: 'script',
  homepageUrl: 'https://www.mmcinfotech.com/',
  companyCareerPage: 'https://www.mmcinfotech.com/career.php',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-job-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mmcinfotech.com',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.mmcinfotech.com/career.php remained the exact first-party MMC Infotech Services careers page and still publicly listed tabbed openings including Voice Operations, Customer Support, Data Entry, and Backend Process with first-party Apply Now links to form.php?job_posting=... pages.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MMC_INFOTECH_SERVICES_CATALOG
