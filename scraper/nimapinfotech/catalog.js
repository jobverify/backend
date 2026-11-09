import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NIMAP_INFOTECH_CATALOG = {
  source: 'nimapinfotech',
  companyName: 'Nimap Infotech',
  officialBrandName: 'Nimap Infotech',
  adapter: 'script',
  homepageUrl: 'https://nimapinfotech.com/',
  companyCareerPage: 'https://nimapinfotech.com/careers/',
  companyDomain: 'nimapinfotech.com',
  atsPlatform: 'first-party-careers-page-external-handoff-no-first-party-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-validation',
  extractionStrategy: 'verified-careers-shell+external-open-positions-handoff+no-first-party-job-cards-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://nimapinfotech.com/careers/ is the live first-party Nimap careers page, that its visible Open Positions handoff points to https://therecruiter.co.in/career/1, and that the official page does not expose same-domain public job cards or first-party detail routes.',
  dryRunFile: 'nimapinfotech/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NIMAP_INFOTECH_CATALOG
