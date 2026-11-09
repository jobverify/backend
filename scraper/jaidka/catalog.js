export const JAIDKA_CATALOG = {
  source: 'jaidka',
  companyName: 'Jaidka',
  officialBrandName: 'Jaidka Power Systems Pvt. Ltd.',
  adapter: 'script',
  modulePath: '../../scraper/jaidka/script.js',
  dryRunFile: 'jaidka/jobs.json',
  homepageUrl: 'https://jaidka.in/',
  companyCareerPage: 'https://jaidka.in/',
  aboutPageUrl: 'https://jaidka.in/About_Company',
  teamPageUrl: 'https://jaidka.in/Team',
  companyDomain: 'jaidka.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-about-plus-team-route-validation',
  extractionStrategy:
    'verified-homepage+verified-about-page+verified-team-page-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://jaidka.in/ is the live first-party Jaidka homepage for Jaidka Power Systems Pvt. Ltd., that https://jaidka.in/About_Company and https://jaidka.in/Team are matching first-party company pages, and that these verified surfaces expose products, dealer information, team biographies, and contact details but no trustworthy public job listings, careers route, ATS handoff, or JobPosting markup. The scraper therefore returns an empty array until a real public jobs surface appears.',
}

export default JAIDKA_CATALOG

