import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRINAMIX_CATALOG = {
  source: 'trinamix',
  companyName: 'TRINAMIX',
  officialBrandName: 'Trinamix',
  adapter: 'script',
  homepageUrl: 'https://www.trinamix.com/',
  companyCareerPage: 'https://careers.trinamix.com/trinamix/',
  companyDomain: 'trinamix.com',
  atsPlatform: 'first-party-careers-shell-with-client-rendered-search',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy:
    'verified-careers-page+current-openings-search-shell-without-server-rendered-roles+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.trinamix.com/trinamix/ was the live first-party Trinamix careers page, surfaced Innovate with Us, Current Openings search controls, and Submit Your Resume, but no server-rendered public role cards or trustworthy enumerable openings were visible from the public shell. This provider therefore remains fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'trinamix/jobs.json',
}

export default TRINAMIX_CATALOG
