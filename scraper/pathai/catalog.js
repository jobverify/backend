import { nativeRouteMetadata, NATIVE_ROUTE_PROFILES } from '../../scraper-support/native-sources/declaredGreenhouseRoutes/nativeCareers.js'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.pathai.com/careers is the live first-party PathAI careers page, that it exposes a first-party Open Positions section under PathAI\'s own domain, that https://job-boards.greenhouse.io/pathai redirects into the PathAI-owned careers experience, and that the public Greenhouse feed at https://boards-api.greenhouse.io/v1/boards/pathai/jobs?content=true returned 9 live roles with first-party https://www.pathai.com/careers/{jobId}?gh_jid={jobId} detail URLs. No India roles were live in the verified public feed on the verified date, so this provider currently returns an honest empty set while the trusted surface remains unchanged.'

const PATH_AI_CATALOG_HISTORICAL = {
  source: 'pathai',
  companyName: 'PathAI',
  adapter: 'script',
  modulePath: '../../scraper/pathai/script.js',
  dryRunFile: 'pathai/jobs.json',
  companyCareerPage: 'https://www.pathai.com/careers',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/pathai',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/pathai/jobs',
  companyDomain: 'pathai.com',
  verifiedPublicJobCount: 9,
  verifiedIndiaJobCount: 0,
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-single-greenhouse-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+greenhouse-jobs-api+first-party-detail-url-canonicalization+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export const PATH_AI_CATALOG = nativeRouteMetadata(NATIVE_ROUTE_PROFILES.pathai, PATH_AI_CATALOG_HISTORICAL)

export default PATH_AI_CATALOG

