export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.diageoindia.com/ is the live official Diageo India homepage, https://www.diageoindia.com/careers is the India careers hub, and https://www.diageoindia.com/en/careers/opportunities-at-diageo is the current India opportunities page, which currently promotes LinkedIn jobs. Verified that the official first-party public jobs surface is https://www.diageo.com/en/careers/search-and-apply, which loads Diageo job search through /en/javascripts/shared/jobs-landing-api.js and the public API https://diageo-prod-api.connectid.cloud/api/jobs?page=1&country=India. Live API checks returned 5 India openings, including Senior Executive - Unit Supply Chain (JR1127198) in Aurangabad and Assistant Manager - Key Accounts (JR1126617) in Pune, with first-party detail page https://www.diageo.com/en/careers/search-and-apply/senior-executive-unit-supply-chain/JR1127198 and external Workday posting https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Aurangabad-India/Senior-Executive---Unit-Supply-Chain_JR1127198.'

export const DIAGEO_INDIA_CATALOG = {
  source: 'diageoindia',
  companyName: 'Diageo India',
  adapter: 'script',
  modulePath: '../../scraper/diageoindia/script.js',
  companyCareerPage: 'https://www.diageo.com/en/careers/search-and-apply',
  homepageUrl: 'https://www.diageoindia.com/',
  indiaCareersUrl: 'https://www.diageoindia.com/careers',
  indiaOpportunitiesUrl: 'https://www.diageoindia.com/en/careers/opportunities-at-diageo',
  jobsApiUrl: 'https://diageo-prod-api.connectid.cloud/api/jobs',
  sampleDetailUrl: 'https://www.diageo.com/en/careers/search-and-apply/senior-executive-unit-supply-chain/JR1127198',
  sampleExternalPostingUrl: 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Aurangabad-India/Senior-Executive---Unit-Supply-Chain_JR1127198',
  companyDomain: 'diageoindia.com',
  atsPlatform: 'first-party-careers-page-plus-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-pages-plus-country-filtered-public-api-pagination',
  extractionStrategy:
    'verified-india-homepage+verified-india-careers-pages+verified-global-search-and-apply-page+public-api-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DIAGEO_INDIA_CATALOG

