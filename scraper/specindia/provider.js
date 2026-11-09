export const provider = {
  source: 'specindia',
  companyName: 'SPEC INDIA',
  officialBrandName: 'SPEC INDIA',
  adapter: 'script',
  modulePath: '../../scraper/specindia/script.js',
  homepageUrl: 'https://www.spec-india.com/',
  companyCareerPage: 'https://www.spec-india.com/career/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'current-advertised-careers-opening-list-and-role-pages-opening-closing',
  extractionStrategy: 'owned-complete-criteria-and-literal-source-fields;all-records-before-India-selection',
  parser: 'native-owned-role-observations',
  normalizationProfile: 'engineering-default',
  companyDomain: 'spec-india.com',
  verifiedOn: null,
  verifiedSurfaceSummary:
    "Current own-role published content and literal source fields are retained by an opt-in reader. Complete employer inventory, recruitment activation, applications, persistence and publication remain unqualified; no static India-zero or source-total claim.",
  dryRunFile: 'specindia/jobs.json',
}

export default provider

