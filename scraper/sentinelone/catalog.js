export const SENTINELONE_CATALOG = {
  source: 'sentinelone',
  companyName: 'SentinelOne',
  officialBrandName: 'SentinelOne',
  adapter: 'script',
  modulePath: '../../scraper/sentinelone/script.js',
  companyCareerPage: 'https://www.sentinelone.com/careers/',
  officialJobsPage: 'https://www.sentinelone.com/jobs/',
  companyDomain: 'sentinelone.com',
  atsPlatform: 'greenhouse',
  greenhouseBoardToken: 'sentinellabs',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/sentinellabs/jobs/?content=true',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-all-published',
  extractionStrategy:
    'verified-first-party-jobs-page+sentinellabs-greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-23',
  verifiedSurfaceSummary:
    'Verified on July 23, 2026 that https://www.sentinelone.com/careers/ links to the live first-party jobs page at https://www.sentinelone.com/jobs/, whose public JavaScript fetches the documented Greenhouse Job Board API at https://boards-api.greenhouse.io/v1/boards/sentinellabs/jobs/?content=true. The API returns all published SentinelOne postings in one response and exposes first-party https://www.sentinelone.com/jobs/?gh_jid=... application URLs, including current India and Bengaluru openings.',
  dryRunFile: 'sentinelone/jobs.json',
}

export default SENTINELONE_CATALOG

