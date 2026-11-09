import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRIMESOFT_ENTERPRISE_CATALOG = {
  source: 'primesoftenterprise',
  companyName: 'Primesoft Enterprise',
  adapter: 'script',
  homepageUrl: 'https://primesoft.net/',
  companyCareerPage: 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  companyDomain: 'primesoft.net',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy:
    'verified-homepage-careers-handoff+official-darwinbox-handoff+darwinbox-listing-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  legacyCareersPageUrl: 'https://primesoft.net/careers/',
  officialCareersHandoffUrl: 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  publicAllJobsUrl: 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  darwinboxOrigin: 'https://primesoft.darwinbox.in',
  darwinboxCompanyId: 'main',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that the first-party PrimeSoft homepage at https://primesoft.net/ exposed a Careers link directly to the official Darwinbox board at https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs, that the legacy first-party careers route at https://primesoft.net/careers/ no longer served the verified careers page surface, and that the public Darwinbox portal returned 16 India openings during verification.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PRIMESOFT_ENTERPRISE_CATALOG
