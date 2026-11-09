import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY = 'Verified on Wednesday, August 5, 2026 that the official Suzlon careers page at https://www.suzlon.com/careers/ still remains a first-party employer-brand page on suzlon.com, but no trustworthy enumerable public jobs surface was verified on or clearly linked from that page. Publicly indexed first-party job-detail URLs exist on the same domain, but without a current first-party-linked enumerable listing surface they are not trustworthy enough for exact coverage, so this provider intentionally fails closed and returns [].'

export const SUZLON_ENERGY_CATALOG = {
  source: 'suzlonenergy',
  companyName: 'Suzlon Energy',
  officialBrandName: 'Suzlon Energy Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://www.suzlon.com/careers/',
  officialCareersPageUrl: 'https://www.suzlon.com/careers/',
  companyDomain: 'suzlon.com',
  atsPlatform: 'official-company-site-no-trustworthy-public-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+return-empty-when-no-trustworthy-public-jobs-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'suzlonenergy/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SUZLON_ENERGY_CATALOG
