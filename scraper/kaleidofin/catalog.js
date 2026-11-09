export const KALEIDOFIN_CATALOG = {
  source: 'kaleidofin',
  companyName: 'Kaleidofin',
  officialBrandName: 'Kaleidofin',
  adapter: 'script',
  modulePath: '../../scraper/kaleidofin/script.js',
  dryRunFile: 'kaleidofin/jobs.json',
  companyCareerPage: 'https://www.kaleidofin.com/careers',
  verifiedSampleJobUrl: 'https://www.kaleidofin.com/careers/software-development-manager',
  companyDomain: 'kaleidofin.com',
  verifiedPublicJobCount: 8,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-linked-role-pages',
  extractionStrategy: 'verified-first-party-careers-page+linked-role-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.kaleidofin.com/careers is the live first-party Kaleidofin careers page and that it publicly listed 8 live roles under first-party detail pages such as https://www.kaleidofin.com/careers/software-development-manager. The careers page exposed role cards for departments including Technology and Data Science, and each linked role page exposed public first-party descriptions, hiring context, and job-location details.',
}

export default KALEIDOFIN_CATALOG

