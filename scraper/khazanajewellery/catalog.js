export const KHAZANA_JEWELLERY_CATALOG = {
  source: 'khazanajewellery',
  companyName: 'Khazana Jewellery',
  officialBrandName: 'Khazana Jewellery',
  adapter: 'script',
  modulePath: '../../scraper/khazanajewellery/script.js',
  dryRunFile: 'khazanajewellery/jobs.json',
  homepageUrl: 'https://www.khazanajewellery.com/',
  companyCareerPage: 'https://www.khazanajewellery.com/careers.html',
  careersApplyEmail: 'careers@khazanajewellery.com',
  atsPlatform: 'official-careers-page-email-only',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-no-listings',
  extractionStrategy: 'verified-careers-policy-page+email-apply-only+no-structured-public-job-listings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'khazanajewellery.com',
  verifiedOn: '2026-08-17',
  verifiedPublicPostingCount: 0,
  verifiedSurfaceSummary:
    'Verified on Monday, August 17, 2026 that https://www.khazanajewellery.com/careers.html is Khazana Jewellery\'s live official careers route, that it remains an email-apply-only surface via careers@khazanajewellery.com with no structured public job listings, and that the legacy https://www.khazanajewellery.com/careers?page_id=33 route now returns a branded 404 storefront shell. Because there is still no trustworthy public jobs surface, this provider remains a fail-closed sentinel that returns no jobs.',
}

export default KHAZANA_JEWELLERY_CATALOG

