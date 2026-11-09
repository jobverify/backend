export const SOPHOS_TECHNOLOGIES_CATALOG = {
  source: 'sophostechnologies',
  companyName: 'Sophos Technologies',
  officialBrandName: 'Sophos',
  adapter: 'script',
  modulePath: '../../scraper/sophostechnologies/script.js',
  companyCareerPage: 'https://www.sophos.com/en-us/company/careers',
  companyDomain: 'sophos.com',
  leverBoardUrl: 'https://jobs.lever.co/sophos',
  leverPostingsApiUrl: 'https://api.lever.co/v0/postings/sophos',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'lever-skip-limit-until-short-page',
  extractionStrategy:
    'verified-first-party-careers-handoff+official-lever-postings-api+india-country-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedPublicJobCount: 114,
  verifiedIndiaJobCount: 13,
  verifiedSampleJobUrl: 'https://jobs.lever.co/sophos/76606093-369d-436c-8541-ad2e8571e6c8',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.sophos.com/en-us/company/careers is the live first-party Sophos careers page, still titles as "Sophos Jobs: Join the Sophos Team | Sophos Careers", and still links Explore our job listings to the official public board at https://jobs.lever.co/sophos. The live Lever postings API at https://api.lever.co/v0/postings/sophos exposed 114 public openings and 13 India-filtered results on the verified date, including Principal Software Engineer 1 (NSG Firewall) in Bangalore and a cross-listed remote posting whose official allLocations explicitly included India.',
  dryRunFile: 'sophostechnologies/jobs.json',
}

export default SOPHOS_TECHNOLOGIES_CATALOG

