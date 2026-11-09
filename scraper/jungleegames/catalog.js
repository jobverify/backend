export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that the previously pinned Junglee Games grow surfaces at https://www.jungleegames.com/, https://www.jungleegames.com/grow.php, and https://www.jungleegames.com/grow-inner-page.php?id=56613313BB were all timing out from this environment. The last directly verified first-party grow surfaces exposed no trustworthy current jobs index, and no trustworthy public jobs surface was reachable from the exact-name domain on Sunday, August 2, 2026.'

export const JUNGLEE_GAMES_CATALOG = {
  source: 'jungleegames',
  companyName: 'Junglee Games',
  officialBrandName: 'Junglee Games',
  adapter: 'script',
  modulePath: '../../scraper/jungleegames/script.js',
  homepageUrl: 'https://www.jungleegames.com/',
  companyCareerPage: 'https://www.jungleegames.com/grow.php',
  verifiedEmptyDepartmentPageUrl: 'https://www.jungleegames.com/grow-inner-page.php?id=56613313BB',
  companyDomain: 'jungleegames.com',
  atsPlatform: 'official-company-site-no-trustworthy-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-grow-page-plus-empty-department-page-validation',
  extractionStrategy: 'verified-first-party-grow-surface-without-trustworthy-current-jobs-index-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'jungleegames/jobs.json',
}

export default JUNGLEE_GAMES_CATALOG

