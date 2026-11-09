export const GLANCE_CATALOG = {
  source: 'glance',
  companyName: 'Glance',
  officialBrandName: 'Glance AI',
  adapter: 'script',
  companyCareerPage: 'https://glance.com/careers',
  companyDomain: 'glance.com',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/glance',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/glance/jobs',
  verifiedSampleJobUrl: 'https://glance.com/careers/7528886',
  verifiedPublicJobCount: 38,
  verifiedIndiaJobCount: 22,
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-next-data-page-plus-single-greenhouse-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-next-data-jobs+greenhouse-jobs-api+first-party-detail-route-canonicalization+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: '../../scraper/glance/script.js',
  dryRunFile: 'glance/jobs.json',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://glance.com/careers is the live first-party Glance jobs page, that it embeds public role data in __NEXT_DATA__ and exposes first-party detail routes under https://glance.com/careers/{jobId}, and that its 38 role IDs match the linked Greenhouse feed at https://boards-api.greenhouse.io/v1/boards/glance/jobs?content=true, including 22 India roles and Applied Scientist II - Recommendation Systems.',
}

export default GLANCE_CATALOG

