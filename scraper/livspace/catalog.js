export const VERIFIED_SURFACE_SUMMARY =
  "Verified on October 3, 2026: https://www.livspace.com/in/careers publishes https://careers.livspace.com/livspace/. The native https://public.zwayam.com/jobs/search feed for verified company15919 enumerates 106 public jobs across12 pages with106 unique IDs matching the advertised total; https://public.zwayam.com/jobs-service/v1/jobs/careersite returned all106 matching details. All106 have verified India scope, including35 formerly dropped rows with exact Indian city/state labels or Chandigarh and no separate country record. Cluster Manager - Retail Ops remains a matching native sample. Unknown or conflicting geography never becomes India; access remains intermittent, so prior success is not an access guarantee."

export const LIVSPACE_CATALOG = {
  source: 'livspace',
  companyName: 'Livspace',
  officialBrandName: 'Livspace',
  adapter: 'script',
  modulePath: '../../scraper/livspace/script.js',
  dryRunFile: 'livspace/jobs.json',
  homepageUrl: 'https://www.livspace.com/',
  companyCareerPage: 'https://www.livspace.com/in/careers',
  careersLandingUrl: 'https://careers.livspace.com/livspace/',
  jobsListUrl: 'https://careers.livspace.com/livspace/jobslist',
  zwayamDomain: 'careers.livspace.com',
  zwayamTenantGroupId: 'G1',
  zwayamCompanyId: 'MTU5MTk=',
  zwayamDetailCompanyId: '15919',
  verifiedPublicJobCount: 106,
  verifiedIndiaJobCount: 106,
  verifiedSampleJobTitle: 'Cluster Manager - Retail Ops',
  verifiedSampleJobUrl:
    'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
  companyDomain: 'livspace.com',
  atsPlatform: 'zwayam',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-public-zwayam-total-count-plus-page-size',
  extractionStrategy: 'verified-official-careers-page+zwayam-board-shell+complete-public-zwayam-pagination+native-detail-api+verified-country-or-city-state-scope',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default LIVSPACE_CATALOG

