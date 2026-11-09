export const CODECLOUDS_CATALOG = {
  source: 'codeclouds',
  companyName: 'CodeClouds',
  officialBrandName: 'CodeClouds',
  adapter: 'script',
  modulePath: '../../scraper/codeclouds/script.js',
  companyCareerPage: 'https://careers.codeclouds.com/jobs/',
  companyDomain: 'careers.codeclouds.com',
  atsPlatform: 'official-company-careers-zero-results',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-zero-results-page',
  extractionStrategy: 'verified-first-party-jobs-page+verified-zero-results-state-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://careers.codeclouds.com/jobs/ is the live first-party CodeClouds jobs page, that it still presents the Search Jobs at CodeClouds heading and hiring@codeclouds.com contact address, and that the verified public page currently shows "Showing 0 jobs" with "No jobs found with current filters" rather than live public job cards.',
  dryRunFile: 'codeclouds/jobs.json',
}

export default CODECLOUDS_CATALOG

