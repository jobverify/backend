export const HEALTHKART_CATALOG = {
  source: 'healthkart',
  companyName: 'HealthKart',
  officialBrandName: 'HealthKart',
  adapter: 'script',
  modulePath: '../../scraper/healthkart/script.js',
  companyCareerPage: 'https://www.healthkart.com/careers',
  companyDomain: 'healthkart.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-validation',
  extractionStrategy: 'verified-generic-careers-page-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'healthkart/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.healthkart.com/careers resolves to a generic HealthKart commerce page titled "Buy Health & Bodybuilding Supplements Online - Healthkart" with footer marketing content and a Careers link, but no trustworthy public jobs surface, ATS handoff, job cards, or JobPosting markup.',
}

export default HEALTHKART_CATALOG

