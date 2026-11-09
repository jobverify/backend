import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COLAN_INFOTECH_CATALOG = {
  source: 'colaninfotech',
  companyName: 'Colan Infotech',
  officialBrandName: 'Colan Infotech Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://colaninfotech.com/',
  companyCareerPage: 'https://colaninfotech.com/career/',
  atsPlatform: 'official-company-careers-single-page-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-inline-job-table-rows+verified-inline-detail-panels+same-page-apply-modal',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'colaninfotech.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://colaninfotech.com/career/ remained Colan Infotech\'s first-party careers page, exposed inline job-card rows for openings including Android Developer (JD005), Data Scientist (JD021), and Data Engineer (JD015), and published adjacent same-page Job Summary / Job Description detail panels plus same-page apply modals.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.resolve(currentDir, 'jobs.json'),
}

export default COLAN_INFOTECH_CATALOG
