import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Tuesday, July 28, 2026 that the previously pinned first-party ATMECS Global jobs route at https://atmecs.com/jobs/ no longer resolves from this environment and now fails before exposing any trustworthy public role inventory. The earlier placeholder-only "[jobs]" contract has therefore degraded further into an unavailable exact host, so this provider remains fail-closed and returns an empty set until ATMECS publishes a reachable first-party jobs surface again.'

export const ATMECS_GLOBAL_CATALOG = {
  source: 'atmecsglobal',
  companyName: 'ATMECS Global',
  officialBrandName: 'ATMECS Global',
  adapter: 'script',
  homepageUrl: 'https://atmecs.com/',
  companyCareerPage: 'https://atmecs.com/jobs/',
  officialCareersPageUrl: 'https://atmecs.com/jobs/',
  companyDomain: 'atmecs.com',
  atsPlatform: 'official-first-party-jobs-page-placeholder-shortcode',
  countryFilter: 'India',
  paginationStrategy: 'single-jobs-page-placeholder-shortcode-or-unavailable-host-validation',
  extractionStrategy:
    'verified-first-party-jobs-page-placeholder-or-unavailable-host+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-28',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'atmecsglobal/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ATMECS_GLOBAL_CATALOG
