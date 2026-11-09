import { nativeRouteMetadata, NATIVE_ROUTE_PROFILES } from '../../scraper-support/native-sources/declaredGreenhouseRoutes/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const LYFT_CATALOG_HISTORICAL = {
  source: 'lyft',
  companyName: 'Lyft',
  officialBrandName: 'Lyft, Inc.',
  adapter: 'script',
  companyCareerPage: 'https://www.lyft.com/careers',
  greenhouseJobsApiUrl: 'https://api.greenhouse.io/v1/boards/lyft/jobs',
  greenhouseJobsApiWithContentUrl: 'https://api.greenhouse.io/v1/boards/lyft/jobs?content=true',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy: 'verified-first-party-careers-shell+verified-greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'lyft.com',
  dryRunFile: 'lyft/jobs.json',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.lyft.com/careers is the current first-party Lyft careers surface, still rendering the "WORKING AT LYFT" shell with the "Search job openings" and "See open jobs" handoff plus a Careers search component anchored at referenceId openings. The live public jobs payload is exposed at https://api.greenhouse.io/v1/boards/lyft/jobs?content=true, which returned 160 public roles on the verified date, with leading locations including San Francisco, CA, Toronto, Canada, and Mexico City, Mexico. That verified payload exposed 0 India-facing roles on Monday, August 3, 2026, and current public detail URLs still resolve through app.careerpuck.com for Lyft job applications.',
  modulePath: path.join(currentDir, 'script.js'),
}

export const LYFT_CATALOG = nativeRouteMetadata(NATIVE_ROUTE_PROFILES.lyft, LYFT_CATALOG_HISTORICAL)

export default LYFT_CATALOG
