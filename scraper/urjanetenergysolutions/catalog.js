import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that Arcadia first-party pages stated Urjanet was acquired in 2022, that Urjanet is fully integrated and not a separate company, and that Arcadia careers is the only current parent hiring surface. Because Urjanet Energy Solutions no longer operates a standalone jobs surface under the exact backlog name, this provider is pinned as a fail-closed acquisition sentinel.'

export const URJANET_ENERGY_SOLUTIONS_CATALOG = {
  source: 'urjanetenergysolutions',
  companyName: 'Urjanet Energy Solutions',
  officialBrandName: 'Arcadia',
  adapter: 'script',
  homepageUrl: 'https://www.arcadia.com/',
  companyCareerPage: 'https://www.arcadia.com/careers',
  companyDomain: 'arcadia.com',
  atsPlatform: 'acquired-company-no-standalone-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-acquisition-sentinel',
  extractionStrategy: 'verified-arcadia-faq+verified-company-history+verified-arcadia-careers-shell+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'urjanetenergysolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default URJANET_ENERGY_SOLUTIONS_CATALOG
