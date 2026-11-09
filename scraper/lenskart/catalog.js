export const LENSKART_CATALOG = {
  source: 'lenskart',
  companyName: 'Lenskart',
  officialBrandName: 'Lenskart',
  adapter: 'script',
  modulePath: '../../scraper/lenskart/script.js',
  dryRunFile: 'lenskart/jobs.json',
  companyCareerPage: 'https://careers.lenskart.com/',
  boardSlug: 'lenskart_ho',
  jobsApiUrl: 'https://ainterviews.com/api/job_board/lenskart_ho/jobs/',
  verifiedSampleJobUrl: 'https://careers.lenskart.com/job_board/lenskart_ho/job/23/',
  verifiedSampleJobTitle: 'Product Manager',
  companyDomain: 'lenskart.com',
  atsPlatform: 'ainterviews-job-board',
  countryFilter: 'India',
  verifiedPublicJobCount: 45,
  paginationStrategy: 'official-careers-subdomain-handoff-plus-ainterviews-jobs-api',
  extractionStrategy: 'verified-lenskart-board-html+board-slug+jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://careers.lenskart.com/ was the live official Lenskart careers handoff, that the board HTML exposed the Lenskart-specific slug lenskart_ho and a powered-by-ainterviews.com job board, and that the public jobs API at https://ainterviews.com/api/job_board/lenskart_ho/jobs/ exposed 45 public jobs including Product Manager.',
}

export default LENSKART_CATALOG

