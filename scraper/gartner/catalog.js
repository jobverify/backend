import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://jobs.gartner.com/jobs/?country=India still browser-renders public India job cards and page-2 pagination, including HR System Ops Specialist (1+ years-Workday HCM), Senior DevOps Engineer - AWS, and Data Scientist. Direct Node requests to the same first-party route currently return a Cloudflare-managed HTTP 403 challenge shell titled "Just a moment..." with cf-mitigated=challenge, so this provider now returns a truthful current-openings signal job when the browser-visible listings cannot be enumerated from the API-only runtime.'

export const GARTNER_CATALOG = {
  source: 'gartner',
  companyName: 'Gartner',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'gartner/jobs.json',
  homepageUrl: 'https://jobs.gartner.com/',
  companyCareerPage: 'https://jobs.gartner.com/jobs/?country=India',
  companyDomain: 'jobs.gartner.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'browser-rendered-page-query-until-no-new-results-or-verified-cloudflare-challenge-signal',
  extractionStrategy: 'browser-rendered-listing-cards+detail-pages+workday-apply-handoff-or-verified-cloudflare-challenge-signal',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default GARTNER_CATALOG
