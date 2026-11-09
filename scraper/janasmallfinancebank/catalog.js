export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 26, 2026 that https://www.jana.bank.in/about-us/careers-hm/ remains the live first-party Jana Small Finance Bank careers route, that it still links to https://www.jana.bank.in/index.php/career/current-openings, and that the linked current-openings surface now resolves to a branded no-public-jobs 404 page instead of a trustworthy public job board.'

export const JANA_SMALL_FINANCE_BANK_CATALOG = {
  source: 'janasmallfinancebank',
  companyName: 'Jana Small Finance Bank',
  officialBrandName: 'Jana Small Finance Bank',
  adapter: 'script',
  modulePath: '../../scraper/janasmallfinancebank/script.js',
  homepageUrl: 'https://www.jana.bank.in/',
  companyCareerPage: 'https://www.jana.bank.in/about-us/careers-hm/',
  currentOpeningsPageUrl: 'https://www.jana.bank.in/index.php/career/current-openings',
  companyDomain: 'jana.bank.in',
  atsPlatform: 'official-company-site-no-trustworthy-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-page-plus-linked-current-openings-surface-validation',
  extractionStrategy: 'verified-first-party-careers-surface-with-no-public-jobs-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-26',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'janasmallfinancebank/jobs.json',
}

export default JANA_SMALL_FINANCE_BANK_CATALOG

