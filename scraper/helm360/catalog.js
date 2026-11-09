import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HELM360_CATALOG = {
  source: 'helm360',
  companyName: 'Helm360',
  officialBrandName: 'Helm360',
  adapter: 'script',
  homepageUrl: 'https://helm360.com/',
  companyCareerPage: 'https://helm360.com/careers/',
  atsPlatform: 'official-company-site-third-party-handoff-only',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+indeed-handoff-only+no-first-party-job-list',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'helm360.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://helm360.com/careers/ remained the exact first-party Helm360 careers page, but it only handed applicants to Indeed through the visible Search Open Jobs and Check out our current openings! links and did not expose a trustworthy first-party public jobs catalog.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HELM360_CATALOG
