export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.polaris.com/en-us/careers/ is the live Polaris first-party careers shell with Search Jobs Now routing to the first-party job categories surface at https://www.polaris.com/en-us/careers/job-categories/all/, that https://www.polaris.com/en-us/locations/ exposes India See Jobs on the official locations page and resolves to the official Bangalore, India location page at https://www.polaris.com/en-us/locations/bangalore-india/, and that public India job detail pages remain live on the first-party domain including https://www.polaris.com/en-us/careers/job-categories/all/apply/r30215/. Direct non-browser fetches to the first-party Polaris careers shells currently return a Cloudflare block in this environment, while the public Workday board at https://polaris.wd5.myworkdayjobs.com/PolarisJobs remains directly accessible and serves the trusted public jobs board used by this provider.'

export const POLARIS_CATALOG = {
  source: 'polaris',
  companyName: 'Polaris',
  officialBrandName: 'Polaris Inc.',
  adapter: 'script',
  modulePath: '../../scraper/polaris.workday/script.js',
  dryRunFile: 'polaris.workday/jobs.json',
  companyCareerPage: 'https://www.polaris.com/en-us/careers/',
  officialJobCategoriesUrl: 'https://www.polaris.com/en-us/careers/job-categories/all/',
  officialLocationsUrl: 'https://www.polaris.com/en-us/locations/',
  officialIndiaLocationUrl: 'https://www.polaris.com/en-us/locations/bangalore-india/',
  workdayBoardUrl: 'https://polaris.wd5.myworkdayjobs.com/PolarisJobs',
  verifiedIndiaLocationCountryId: 'c4f78be1a8f14da0ab49ce1162348a5e',
  verifiedFirstPartyIndiaJobUrl:
    'https://www.polaris.com/en-us/careers/job-categories/all/apply/r30215/',
  verifiedWorkdayIndiaJobUrl:
    'https://polaris.wd5.myworkdayjobs.com/en-US/PolarisJobs/job/Bangalore-India/Senior-Software-Engineer_R28999',
  verifiedWorkdayIndiaApplyUrl:
    'https://polaris.wd5.myworkdayjobs.com/en-US/PolarisJobs/job/Bangalore-India/Senior-Software-Engineer_R28999/apply',
  companyDomain: 'polaris.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-shell-plus-public-workday-board',
  extractionStrategy:
    'verified-first-party-careers-pages+cloudflare-aware-shell-validation+shared-workday-dom-scraper',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default POLARIS_CATALOG

