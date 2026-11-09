export const GLAND_PHARMA_CATALOG = {
  source: 'glandpharma',
  companyName: 'Gland Pharma',
  officialBrandName: 'Gland Pharma Limited',
  adapter: 'script',
  homepageUrl: 'https://glandpharma.com/',
  companyCareerPage: 'https://glandpharma.com/careers',
  companyDomain: 'glandpharma.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-shell-route-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-shell-routes-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: '../../scraper/glandpharma/script.js',
  dryRunFile: 'glandpharma/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://glandpharma.com/ is the live first-party Gland Pharma homepage and that https://glandpharma.com/careers plus the adjacent first-party routes /career and /jobs resolve to the same branded Gland Pharma shell with organization metadata and contact footer chrome, but no trustworthy public job listings, ATS links, or JobPosting markup. The scraper therefore returns an empty array until a real public jobs surface appears.',
}

export default GLAND_PHARMA_CATALOG

