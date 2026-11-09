export const FUTURISM_TECHNOLOGIES_CATALOG = {
  source: 'futurismtechnologies',
  companyName: 'Futurism Technologies',
  officialBrandName: 'Futurism Technologies',
  companyCareerPage: 'https://www.futurismtechnologies.com/careers/',
  companyDomain: 'futurismtechnologies.com',
  homepageUrl: 'https://www.futurismtechnologies.com/',
  adapter: 'script',
  atsPlatform: 'official-careers-surface-blocked',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-url-cloudflare-block-validation',
  extractionStrategy: 'verified-first-party-careers-url+cloudflare-block-page+no-trustworthy-public-job-records-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: 'scraper/futurismtechnologies/script.js',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.futurismtechnologies.com/careers/ returned a first-party Cloudflare block page rather than trustworthy public job records, so no trustworthy public jobs surface was available to scrape from this environment.',
}

export default FUTURISM_TECHNOLOGIES_CATALOG
