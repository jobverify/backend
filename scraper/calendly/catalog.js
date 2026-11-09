import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified on October 9, 2026 that https://calendly.com/careers is the live official Calendly careers page with Careers at Calendly, the current hero, location/department filters and nine role cards. The Featured heading is optional because the current page has no featured openings. All nine card IDs match https://job-boards.greenhouse.io/calendly and the complete feed at https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true, which reports 9 live roles. All nine native application details are live and agree on titles, full descriptions and US locations (Remote - US or San Francisco (Hybrid)); no India roles. Runtime reconciles the reported total, unique IDs, current first-party cards, full decoded descriptions, location countries and a stable second complete feed before returning the India slice."

export const CALENDLY_CATALOG = {
  source: 'calendly',
  companyName: 'Calendly',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'calendly/jobs.json',
  companyCareerPage: 'https://calendly.com/careers',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/calendly',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/calendly/jobs',
  companyDomain: 'calendly.com',
  verifiedPublicJobCount: 9,
  verifiedIndiaJobCount: 0,
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'complete-greenhouse-count-and-stable-snapshot',
  extractionStrategy:
    'verified-calendly-handoff+careers-card-ids+complete-feed+full-content+stable-snapshot+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default CALENDLY_CATALOG
