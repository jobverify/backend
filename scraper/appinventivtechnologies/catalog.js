import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APPINVENTIV_TECHNOLOGIES_CATALOG = {
  source: 'appinventivtechnologies',
  companyName: 'AppInventiv Technologies',
  officialBrandName: 'Appinventiv',
  adapter: 'script',
  companyCareerPage: 'https://appinventiv.com/career/',
  officialCareersPageUrl: 'https://appinventiv.com/career/',
  companyDomain: 'appinventiv.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-career-page+embedded-job-modals',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://appinventiv.com/career/ is the live first-party Appinventiv careers page and that it publicly exposes embedded job modals for current roles including AL/ML Engineer, Tech Lead Node.js, and Business Manager - Government Sales. The same verified page exposes modal fields such as Location : Noida, Experience : 4-6 Years, and the first-party resume handoff email career@appinventiv.com, so this provider is pinned to the single first-party careers page.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'appinventivtechnologies/jobs.json',
}

export default APPINVENTIV_TECHNOLOGIES_CATALOG
