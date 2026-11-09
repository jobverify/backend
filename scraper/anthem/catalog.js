export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://anthembio.com/ is the live official Anthem homepage, that https://anthembio.com/careers/ is the first-party careers page published in https://anthembio.com/page-sitemap.xml, and that the careers page directly hands applicants to the public PeopleStrong portal at https://anthemhrcp.peoplestrong.com/. The linked public jobs API at https://anthemhrcp.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20 returned a successful empty payload with totalRecords: 0 and response: [] during live checks, even though the first-party careers page currently displays the CTA text "Open Positions (5)".'

export const ANTHEM_CATALOG = {
  source: 'anthem',
  companyName: 'Anthem',
  adapter: 'script',
  modulePath: '../../scraper/anthem/script.js',
  companyCareerPage: 'https://anthembio.com/careers/',
  homepageUrl: 'https://anthembio.com/',
  robotsTxtUrl: 'https://anthembio.com/robots.txt',
  sitemapIndexUrl: 'https://anthembio.com/sitemap.xml',
  pageSitemapUrl: 'https://anthembio.com/page-sitemap.xml',
  portalOrigin: 'https://anthemhrcp.peoplestrong.com',
  jobListingsUrl: 'https://anthemhrcp.peoplestrong.com/',
  jobsApiUrl: 'https://anthemhrcp.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  companyDomain: 'anthembio.com',
  atsPlatform: 'peoplestrong',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-plus-first-party-careers-page-plus-offset-limit-api',
  extractionStrategy:
    'official-homepage+official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ANTHEM_CATALOG

