import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIGNZY_CATALOG = {
  source: 'signzy',
  companyName: 'Signzy',
  officialBrandName: 'Signzy Technologies Private Limited',
  adapter: 'script',
  companyCareerPage: 'https://www.signzy.com/careers',
  officialCareersPageUrl: 'https://www.signzy.com/careers',
  verifiedBrokenJobsCtaUrl: 'https://www.signzy.com/carrers',
  companyDomain: 'signzy.com',
  atsPlatform: 'first-party-careers-page-with-broken-jobs-cta',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy:
    'verified-first-party-careers-page+broken-first-party-jobs-cta+no-trustworthy-public-job-listings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on Sunday, July 19, 2026 that the official Signzy careers page for this exact-name provider was https://www.signzy.com/careers. The first-party page exposed the View All Positions call-to-action, but that CTA resolved to https://www.signzy.com/carrers and loops back to the careers page instead of exposing a trustworthy public jobs board or public role detail pages, so this provider is intentionally fail-closed and returns an honest empty list until the official surface exposes trustworthy public jobs.',
  dryRunFile: 'signzy/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SIGNZY_CATALOG
