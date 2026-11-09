export const KALE_LOGISTICS_CATALOG = {
  source: 'kalelogistics',
  companyName: 'Kale Logistics',
  officialBrandName: 'Kalé Logistics Solutions',
  adapter: 'script',
  modulePath: '../../scraper/kalelogistics/script.js',
  dryRunFile: 'kalelogistics/jobs.json',
  homepageUrl: 'https://www.kalelogistics.com/',
  companyCareerPage: 'https://www.kalelogistics.com/careers',
  officialCareersHandoffUrl: 'https://kale.darwinbox.in/ms/candidatev2/main/careers/home',
  darwinboxOrigin: 'https://kale.darwinbox.in',
  darwinboxCompanyId: 'main',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'kalelogistics.com',
  verifiedOn: '2026-07-16',
  verifiedPublicPostingCount: 2,
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.kalelogistics.com/careers is the live first-party Kale Logistics careers page and links View Opportunities to the official Darwinbox portal at https://kale.darwinbox.in/ms/candidatev2/main/careers/home. Direct non-browser requests to the public Darwinbox listing API were Cloudflare-protected during verification, but the public candidate portal remained scrapeable through the repo browser-session Darwinbox flow and returned 2 India jobs.',
}

export default KALE_LOGISTICS_CATALOG

