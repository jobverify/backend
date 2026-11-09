import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VELOCITY_SOFTWARE_SOLUTIONS_CATALOG = {
  source: 'velocitysoftwaresolutions',
  companyName: 'Velocity Software Solutions',
  officialBrandName: 'Velocity',
  adapter: 'script',
  homepageUrl: 'https://www.velsof.com/',
  companyCareerPage: 'https://www.velsof.com/careers/',
  companyDomain: 'velsof.com',
  atsPlatform: 'first-party-careers-page-plus-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-index-plus-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-index+job-post-detail-pages+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.velsof.com/careers/ is the exact-name first-party Velocity Software Solutions careers index and that it publicly listed UI/UX Designer, Flutter Mobile App Developer, and Senior Laravel Developer openings in Noida with linked first-party detail pages under https://www.velsof.com/jobs/. This provider follows those detail pages directly and keeps only India roles.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'velocitysoftwaresolutions/jobs.json',
}

export default VELOCITY_SOFTWARE_SOLUTIONS_CATALOG
