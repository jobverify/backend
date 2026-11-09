import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DATA_TEMPLATE_INFOTECH_CATALOG = {
  source: 'datatemplateinfotech',
  companyName: 'Data Template Infotech',
  officialBrandName: 'Data Template Infotech',
  adapter: 'script',
  homepageUrl: 'https://www.datatemplate.com/',
  companyCareerPage: 'https://www.datatemplate.com/en/careers/',
  officialCareersPageUrl: 'https://www.datatemplate.com/en/careers/',
  atsPlatform: 'official-company-site-no-public-job-records',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-without-public-job-records',
  extractionStrategy: 'verified-first-party-careers-page+returns-empty-array',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'datatemplate.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.datatemplate.com/en/careers/ was the live first-party Data Template Infotech careers page, that it exposed the Current openings heading and the careers@datatemplate.com intake path for applicants in India, and that the page still presented no public job records or batch-safe first-party listing surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'datatemplateinfotech/jobs.json',
}

export default DATA_TEMPLATE_INFOTECH_CATALOG
