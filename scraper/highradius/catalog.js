export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.highradius.com/about/career/ is the live first-party HighRadius careers page, that it exposes first-party gh_jid detail routes under https://www.highradius.com/about/careers-list/?gh_jid={jobId}, and that the linked public Greenhouse feed at https://boards-api.greenhouse.io/v1/boards/highradius/jobs?content=true returned 67 live roles and 50 India roles including Agent Developer Test III and Analyst - Strategic Alliances.'

export const HIGHRADIUS_CATALOG = {
  source: 'highradius',
  companyName: 'HighRadius',
  officialBrandName: 'HighRadius Corporation',
  adapter: 'script',
  modulePath: '../../scraper/highradius/script.js',
  dryRunFile: 'highradius/jobs.json',
  companyCareerPage: 'https://www.highradius.com/about/career/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/highradius',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/highradius/jobs',
  verifiedSampleJobUrl: 'https://www.highradius.com/about/careers-list/?gh_jid=7611164003',
  companyDomain: 'highradius.com',
  verifiedPublicJobCount: 67,
  verifiedIndiaJobCount: 50,
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-single-greenhouse-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+greenhouse-jobs-api+first-party-gh-jid-detail-route+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default HIGHRADIUS_CATALOG

