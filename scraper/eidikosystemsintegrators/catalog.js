import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EIDIKO_SYSTEMS_INTEGRATORS_CATALOG = {
  source: 'eidikosystemsintegrators',
  companyName: 'Eidiko Systems Integrators',
  officialBrandName: 'Eidiko',
  adapter: 'script',
  homepageUrl: 'https://eidiko.com/',
  companyCareerPage: 'https://eidiko.com/careers/',
  companyDomain: 'eidiko.com',
  atsPlatform: 'first-party-awsm-jobs-board',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-awsm-post-grid',
  extractionStrategy: 'verified-first-party-careers-page+awsm-job-openings-cards+same-domain-detail-pages+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://eidiko.com/careers/ is the live first-party Eidiko careers page and that it exposes a public AWsm jobs grid with openings including Technical Delivery Leads, Charlotte, NC, Another AS 400 / i Series Developer in Bangalore, and AS 400 / i Series Developer in Hyderabad. The Bangalore and Hyderabad detail pages under https://eidiko.com/job/ expose same-domain public job descriptions and inline apply forms, so this scraper now extracts the verified India openings from the first-party careers board.',
  dryRunFile: 'eidikosystemsintegrators/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EIDIKO_SYSTEMS_INTEGRATORS_CATALOG
