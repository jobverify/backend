export const HEALTHIFYME_CATALOG = {
  source: 'healthifyme',
  companyName: 'HealthifyMe',
  officialBrandName: 'HealthifyMe Wellness Private Limited',
  adapter: 'script',
  modulePath: '../../scraper/healthifyme/script.js',
  companyCareerPage: 'https://www.healthifyme.com/careers/',
  companyDomain: 'healthifyme.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://healthify.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://healthify.darwinbox.in',
  darwinboxCompanyId: 'main',
  dryRunFile: 'healthifyme/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.healthifyme.com/careers/ is the live first-party HealthifyMe careers page and that its View Openings call-to-action hands job seekers to the official Darwinbox candidate portal at https://healthify.darwinbox.in/ms/candidate/careers.',
}

export default HEALTHIFYME_CATALOG

