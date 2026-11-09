export const provider = {
  source: 'mapsystems',
  companyName: 'MAP Systems',
  officialBrandName: 'MAPSystems',
  adapter: 'script',
  modulePath: '../../scraper/mapsystems/script.js',
  homepageUrl: 'https://mapsystemsindia.com/',
  companyCareerPage: 'https://mapsystemsindia.com/careers.html',
  atsPlatform: 'first-party-static-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-static-careers-page',
  extractionStrategy: 'verified-first-party-static-careers-page+job-box-text-sections+mailto-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mapsystemsindia.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://mapsystemsindia.com/careers.html was the live first-party MAPSystems careers page, published static job-box text for roles including Inside Sales Executive and Jr Java Script / HTML5 Developer, and directed applicants to career@mapsystems.in for submissions.',
  dryRunFile: 'mapsystems/jobs.json',
}

export default provider

