export const FUTURESOFT_INDIA_CATALOG = {
  source: 'futuresoftindia',
  companyName: 'FutureSoft India',
  officialBrandName: 'FutureSoft India',
  adapter: 'script',
  modulePath: '../../scraper/futuresoftindia/script.js',
  companyCareerPage: 'https://futuresoftindia.com/careers/',
  companyDomain: 'futuresoftindia.com',
  atsPlatform: 'official-company-careers-zero-results',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-table-zero-row-state',
  extractionStrategy:
    'verified-first-party-careers-page+verified-filter-options+zero-rendered-job-rows-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://futuresoftindia.com/careers/ is the live first-party FutureSoft India careers page, that it still exposes the Careers at FutureSoft India heading, job-title and location filters, and the public jobs table headers Job Code, Job Title, Location, Experience (Yrs), and Action, and that the verified page currently renders zero public job rows in the fetched first-party HTML.',
  dryRunFile: 'futuresoftindia/jobs.json',
}

export default FUTURESOFT_INDIA_CATALOG

