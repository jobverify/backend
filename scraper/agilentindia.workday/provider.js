export const provider = {
  source: 'agilentindia',
  companyName: 'Agilent India',
  officialBrandName: 'Agilent',
  adapter: 'script',
  modulePath: '../../scraper/agilentindia.workday/script.js',
  companyCareerPage: 'https://careers.agilent.com/',
  indiaLocationPage: 'https://careers.agilent.com/locations/asia-pacific/india/',
  experiencedWorkdayPage: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers',
  studentWorkdayPage: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers',
  experiencedJobsApiUrl: 'https://agilent.wd5.myworkdayjobs.com/wday/cxs/agilent/Agilent_Careers/jobs',
  studentJobsApiUrl: 'https://agilent.wd5.myworkdayjobs.com/wday/cxs/agilent/Agilent_Student_Careers/jobs',
  atsPlatform: 'workday-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-pages-plus-dual-workday-country-facet-apis-or-maintenance-sentinel',
  extractionStrategy:
    'verified-careers-home+verified-india-location-page+experienced-workday-jobs-api+student-workday-jobs-api-or-dual-workday-maintenance-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'agilent.com',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    "Verified on Saturday, August 15, 2026 that https://careers.agilent.com/ and https://careers.agilent.com/locations/asia-pacific/india/ still hand applicants to the public Workday boards at https://agilent.wd5.myworkdayjobs.com/Agilent_Careers and https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers, but both official Workday boards are currently showing the \"Workday is currently unavailable.\" maintenance page and the corresponding jobs APIs return HTML maintenance content instead of JSON. This scraper therefore preserves the normal dual-board India jobs extraction when Workday is healthy and returns an honest empty result while both public boards remain in verified maintenance mode.",
  dryRunFile: 'agilentindia.workday/jobs.json',
}

export default provider

