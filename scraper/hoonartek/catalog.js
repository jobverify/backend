import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://hoonartek.com/company/career/ is the live first-party Hoonartek careers page, that it embeds a public SenseHQ postings call to https://hoonartek.sensehq.com/careers/api/postings, and that the public SenseHQ detail API at https://hoonartek.sensehq.com/careers/api/postings/{id} is live for individual roles. The verified postings API currently returns 58 public postings and 9 India roles. Verified sample India role: Azure Data Engineer in Pune, India at https://hoonartek.sensehq.com/careers/jobs/55244.'

export const HOONARTEK_CATALOG = {
  source: 'hoonartek',
  companyName: 'Hoonartek',
  officialBrandName: 'Hoonartek',
  adapter: 'script',
  dryRunFile: 'hoonartek/jobs.json',
  companyCareerPage: 'https://hoonartek.com/company/career/',
  officialJobsApiUrl: 'https://hoonartek.sensehq.com/careers/api/postings',
  publicJobDetailBaseUrl: 'https://hoonartek.sensehq.com/careers/jobs/',
  publicJobDetailApiBaseUrl: 'https://hoonartek.sensehq.com/careers/api/postings/',
  atsPlatform: 'sensehq',
  countryFilter: 'India',
  paginationStrategy: 'single-public-postings-api-with-per-job-detail-fetch',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-sensehq-postings-api+public-sensehq-detail-api+india-office-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'hoonartek.com',
  verifiedOn: '2026-07-16',
  verifiedPublicPostingCount: 58,
  verifiedIndiaRoleCount: 9,
  verifiedSampleJobUrl: 'https://hoonartek.sensehq.com/careers/jobs/55244',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HOONARTEK_CATALOG
