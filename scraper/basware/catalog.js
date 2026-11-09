import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Current https://careers.basware.com/ configuration binds jobylon-jobs-widget to native group 195 via https://cdn.jobylon.com/embedder.js. Public inventory completeness is evaluated per run from the unfiltered employer binding, reviewed live loader/controller, all-row country-office partition, complete India details and matching closing inventory. Failed proof retains verified roles and forbids cleanup. Legal-company universality remains unknown; observed rows are not publisher-reported totals.'

export const BASWARE_CATALOG = {
  source: 'basware',
  companyName: 'Basware',
  officialBrandName: 'Basware',
  adapter: 'script',
  homepageUrl: 'https://www.basware.com/',
  companyCareerPage: 'https://careers.basware.com/',
  officialCareersPageUrl: 'https://careers.basware.com/',
  companyDomain: 'basware.com',
  atsPlatform: 'jobylon-native-widget',
  countryFilter: 'India',
  zeroResultPolicy: 'evidence-required',
  sourceScopeComplete: false,
  paginationStrategy: 'complete-inline-widget-array-and-closing-reconciliation',
  extractionStrategy:
    'current-first-party-group-binding+native-widget-records+verified-full-role-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'basware/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BASWARE_CATALOG
