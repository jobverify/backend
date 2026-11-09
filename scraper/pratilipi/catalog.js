import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRATILIPI_CATALOG = {
  source: 'pratilipi',
  companyName: 'Pratilipi',
  officialBrandName: 'Pratilipi',
  adapter: 'script',
  homepageUrl: 'https://www.pratilipi.com/',
  companyCareerPage: 'https://www.pratilipi.com/careers',
  officialCareersHandoffUrl: 'https://pratilipi.talentzq.io/careers',
  companyDomain: 'pratilipi.com',
  atsPlatform: 'official-company-site-broken-ats-shell',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-link-plus-opaque-talentzq-shell-validation',
  extractionStrategy:
    'verified-official-careers-link+verified-opaque-talentzq-shell-without-trustworthy-public-job-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.pratilipi.com/careers is the live first-party Pratilipi careers page and that it hands job seekers to https://pratilipi.talentzq.io/careers. The TalentzQ handoff resolved to an opaque TalentzQ shell with the message "An unhandled error has occurred." and exposed no trustworthy public jobs surface through static public fetch, so this provider intentionally fails closed until Pratilipi exposes a verifiable public jobs board.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pratilipi/jobs.json',
}

export default PRATILIPI_CATALOG
