import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://spiretechno.com/ is the live exact-name first-party Spire Technologies website, that it presents the company as a digital marketing and automation business rather than a public hiring surface, and that it still exposes company contact details including support@spiretechnologies.in and www.spiretechnologies.in. There is no trustworthy public jobs surface for the exact-name Spire Technologies row right now, so this provider fails closed and returns no jobs until Spire Technologies publishes a stable verifiable careers or jobs surface.'

export const SPIRE_TECHNOLOGIES_CATALOG = {
  source: 'spiretechnologies',
  companyName: 'Spire Technologies',
  officialBrandName: 'Spire Technologies',
  adapter: 'script',
  companyCareerPage: 'https://spiretechno.com/',
  officialCareersPageUrl: 'https://spiretechno.com/',
  companyDomain: 'spiretechno.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-official-homepage-no-public-careers-surface',
  extractionStrategy: 'verified-official-homepage+no-public-careers-signal+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'spiretechnologies/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SPIRE_TECHNOLOGIES_CATALOG
