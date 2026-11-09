export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.jcb.com/en-IN/explore/engage/careers/ is the live first-party JCB India careers route, that it routes candidates to the first-party search board at https://career-in.jcb.com/search/, and that the accessible search results and detail pages expose public roles such as Engineer, Assistant Manager, and Senior Engineer - MEP on the JCB India surface.'

export const JCB_INDIA_CATALOG = {
  source: 'jcbindia',
  companyName: 'JCB India',
  officialBrandName: 'JCB India',
  adapter: 'script',
  modulePath: '../../scraper/jcbindia/script.js',
  companyCareerPage: 'https://www.jcb.com/en-IN/explore/engage/careers/',
  officialCareersPageUrl: 'https://www.jcb.com/en-IN/explore/engage/careers/',
  officialJobsBoardUrl: 'https://career-in.jcb.com/',
  accessibleSearchUrl: 'https://career-in.jcb.com/search/',
  detailUrlPattern: 'https://career-in.jcb.com/job/{slug}/{jobId}/',
  companyDomain: 'jcb.com',
  atsPlatform: 'official-company-jobs-board',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-accessible-search-results-pagination',
  extractionStrategy: 'verified-first-party-careers-page+accessible-search-results+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'jcbindia/jobs.json',
}

export default JCB_INDIA_CATALOG

