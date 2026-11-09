import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SENSIPLE_CATALOG = {
  source: 'sensiple',
  companyName: 'Sensiple',
  officialBrandName: 'Sensiple',
  adapter: 'script',
  companyCareerPage: 'https://www.sensiple.com/careers/',
  jobsApiUrl: 'https://www.sensiple.com/wp-admin/admin-ajax.php?action=get_jobs_secure',
  companyDomain: 'sensiple.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-admin-ajax-payload',
  extractionStrategy: 'verified-careers-page+same-domain-admin-ajax-jobs-payload',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sensiple.com/careers/ is the live first-party Sensiple careers page, that the page exposes a same-domain jobs widget fetching https://www.sensiple.com/wp-admin/admin-ajax.php?action=get_jobs_secure, and that the payload currently returns active openings including Business Development Executive in Chennai.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sensiple/jobs.json',
}

export default SENSIPLE_CATALOG
