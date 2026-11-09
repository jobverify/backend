import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SPINNY_CATALOG = {
  source: 'spinny',
  companyName: 'Spinny',
  officialBrandName: 'Spinny',
  adapter: 'script',
  companyCareerPage: 'https://www.spinny.com/careers/',
  companyDomain: 'spinny.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://spinzone.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://spinzone.darwinbox.in',
  darwinboxCompanyId: 'main',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on July 17, 2026 that https://www.spinny.com/careers/ is the live first-party Spinny careers page and that its "See Job Openings" handoff points applicants to the official Spinny Darwinbox candidate host at https://spinzone.darwinbox.in/ms/candidate/careers.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SPINNY_CATALOG
