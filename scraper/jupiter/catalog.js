export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://jupiter.money/careers/ remains the live first-party Jupiter careers page, that it still hands off public openings to https://jupiter.keka.com/careers, and that https://jupiter.keka.com/careers/api/organization/default/careerportalinfo plus https://jupiter.keka.com/careers/api/embedjobs/default/active/b5279857-cf81-4dde-a215-fc48957ee2b5 returned the public Jupiter Money careers portal with 13 active public openings including Devops Engineer - SDE 2.'

export const JUPITER_CATALOG = {
  source: 'jupiter',
  companyName: 'Jupiter',
  officialBrandName: 'Jupiter Money',
  adapter: 'script',
  modulePath: '../../scraper/jupiter/script.js',
  companyCareerPage: 'https://jupiter.money/careers/',
  officialCareersPageUrl: 'https://jupiter.money/careers/',
  officialJobsBoardUrl: 'https://jupiter.keka.com/careers',
  careerPortalInfoUrl: 'https://jupiter.keka.com/careers/api/organization/default/careerportalinfo',
  activeJobsUrl: 'https://jupiter.keka.com/careers/api/embedjobs/default/active/b5279857-cf81-4dde-a215-fc48957ee2b5',
  departmentsUrl: 'https://jupiter.keka.com/careers/api/embedjobs/departments/b5279857-cf81-4dde-a215-fc48957ee2b5',
  groupLinkStatusUrl: 'https://jupiter.keka.com/careers/api/embedjobs/grouplinkstatus/b5279857-cf81-4dde-a215-fc48957ee2b5',
  expectedKekaDomain: 'https://jupiter.keka.com/careers/',
  expectedIdentifier: 'b5279857-cf81-4dde-a215-fc48957ee2b5',
  companyDomain: 'jupiter.money',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  verifiedActiveJobCount: 13,
  verifiedActiveSampleTitle: 'Devops Engineer - SDE 2',
  paginationStrategy: 'verified-first-party-careers-page-plus-keka-active-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+verified-keka-careers-link+careerportalinfo+active-keka-embed-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'jupiter/jobs.json',
}

export default JUPITER_CATALOG

