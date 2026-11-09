export const IMAGE_INFORMATION_SYSTEMS_CATALOG = {
  source: 'imageinformationsystems',
  companyName: 'Image Information Systems',
  officialBrandName: 'IMAGE Information Systems Europe GmbH',
  adapter: 'script',
  homepageUrl: 'https://www.iq-image.com/',
  companyCareerPage: 'https://www.iq-image.com/join-our-team/',
  companyDomain: 'iq-image.com',
  atsPlatform: 'official-company-site',
  countryFilter: 'Global',
  paginationStrategy: 'single-first-party-listing-page-plus-first-party-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+visible-job-detail-pages+active-application-signals',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedSampleJobUrl: 'https://www.iq-image.com/job/frontend-developer-m-f-d/',
  modulePath: '../../scraper/imageinformationsystems/script.js',
  dryRunFile: 'imageinformationsystems/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.iq-image.com/join-our-team/ is the live first-party IMAGE Information Systems careers page and that it still exposes the first-party detail route https://www.iq-image.com/job/frontend-developer-m-f-d/ with role text, location, hr@iq-image.com application instructions, and an on-page application form. The listing page still carries stale "We currently do not have any open positions" copy, so the scraper only trusts explicitly linked /job/ detail pages that continue to expose active application signals.',
}

export default IMAGE_INFORMATION_SYSTEMS_CATALOG

