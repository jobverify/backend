import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PERENNIAL_SYSTEMS_CATALOG = {
  source: 'perennialsystems',
  companyName: 'Perennial Systems',
  officialBrandName: 'Perennial',
  adapter: 'script',
  companyCareerPage: 'https://perennialsys.com/careers/',
  officialJobOpeningsPageUrl: 'https://perennialsys.com/job-openings',
  companyDomain: 'perennialsys.com',
  atsPlatform: 'official-company-careers-coming-soon',
  countryFilter: 'India',
  paginationStrategy: 'careers-shell-plus-coming-soon-validation',
  extractionStrategy: 'verified-careers-shell+verified-job-openings-coming-soon+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://perennialsys.com/careers/ was the live first-party Perennial Systems careers shell, but the linked first-party openings route at https://perennialsys.com/job-openings still rendered only a Coming Soon placeholder instead of public role cards or job detail pages. This provider therefore remains fail-closed until Perennial publishes a trustworthy first-party openings surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'perennialsystems/jobs.json',
}

export default PERENNIAL_SYSTEMS_CATALOG
