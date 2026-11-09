export const AIRBNB_CATALOG = {
  source: 'airbnb',
  companyName: 'Airbnb',
  companyCareerPage: 'https://careers.airbnb.com/positions/',
  companyDomain: 'airbnb.com',
  adapter: 'script',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-redirect-plus-first-party-wordpress-archive-pagination',
  extractionStrategy: 'verified-careers-home+verified-positions-archive+first-party-detail-urls+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: 'scraper/airbnb/script.js',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.airbnb.com/careers redirects to the official first-party careers site at https://careers.airbnb.com/, and the public positions archive at https://careers.airbnb.com/positions/ paginates first-party Airbnb job cards and detail URLs, including current India roles in Bangalore and Gurugram.',
  officialCareersEntryUrl: 'https://www.airbnb.com/careers',
  officialCareersHomeUrl: 'https://careers.airbnb.com/',
  positionsUrl: 'https://careers.airbnb.com/positions/',
}

export default AIRBNB_CATALOG
