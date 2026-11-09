import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY = 'Verified on October 3, 2026 that the official Syllable AI careers page still links directly to the exact Syllable Corporation Rippling board. The board visibly reports no open roles and its hydrated unfiltered job-posts query succeeds with items [], totalItems 0 and totalPages 0. Exact company, slug, URL and query identity are checked before accepting zero jobs.'

export const SYLLABLE_CATALOG = {
  source: 'syllable',
  companyName: 'Syllable',
  officialBrandName: 'Syllable AI',
  adapter: 'script',
  companyCareerPage: 'https://syllable.ai/careers',
  officialCareersPageUrl: 'https://syllable.ai/careers',
  linkedJobsBoardUrl: 'https://ats.rippling.com/syllable-corporation/jobs',
  linkedJobsBoardHost: 'ats.rippling.com',
  linkedJobsBoardSlug: 'syllable-corporation',
  companyDomain: 'syllable.ai',
  atsPlatform: 'rippling',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-linked-rippling-board-page',
  extractionStrategy: 'verified-first-party-careers-page+verified-rippling-listings-or-explicit-unfiltered-zero-payload+India-job-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  dryRunFile: 'syllable/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SYLLABLE_CATALOG
