import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.tivo.com/ is the live first-party TiVo homepage and its footer sends candidates to the shared parent careers page at https://xperi.com/careers/ plus the shared locations page at https://xperi.com/company/locations/. The shared Xperi careers page explicitly describes TiVo as one of the Xperi brands, and the shared Xperi locations page lists India offices in Bangalore and Pune, but no distinct TiVo India public jobs board or exact-name TiVo India listings were verifiable on those first-party surfaces. There is no trustworthy public jobs surface for the exact-name TiVo India row right now, so this provider fails closed and returns no jobs until a stable TiVo India-specific public board appears.'

export const TIVO_INDIA_CATALOG = {
  source: 'tivoindia',
  companyName: 'TiVo India',
  officialBrandName: 'TiVo',
  adapter: 'script',
  companyCareerPage: 'https://xperi.com/careers/',
  officialBrandHomepageUrl: 'https://www.tivo.com/',
  officialCareersPageUrl: 'https://xperi.com/careers/',
  officialLocationsPageUrl: 'https://xperi.com/company/locations/',
  companyDomain: 'tivo.com',
  atsPlatform: 'shared-parent-careers-no-distinct-exact-name-board',
  countryFilter: 'India',
  paginationStrategy: 'verified-brand-homepage-plus-shared-parent-careers-no-exact-name-public-board',
  extractionStrategy:
    'verified-tivo-homepage+verified-xperi-careers+verified-xperi-india-locations+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'tivoindia/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TIVO_INDIA_CATALOG
