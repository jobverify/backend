export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.htcinc.com/careers/ is the live first-party HTC Global Services careers landing page, that it links candidates to the public jobs listing page at https://www.htcinc.com/career-job-listing/, and that the listing page loads its openings from the first-party JSON proxy at https://www.htcinc.com/wp-content/themes/himalayas-child/job-api-proxy.php. During verification, that proxy returned 19 live roles and 17 India roles, plus 2 Abu Dhabi roles, so the scraper conservatively keeps only India openings and canonicalizes them to the first-party detail and apply routes.'

export const HTC_GLOBAL_SERVICES_CATALOG = {
  source: 'htcglobalservices',
  companyName: 'HTC Global Services',
  officialBrandName: 'HTC Global Services',
  adapter: 'script',
  homepageUrl: 'https://www.htcinc.com/',
  companyCareerPage: 'https://www.htcinc.com/careers/',
  jobsListingPageUrl: 'https://www.htcinc.com/career-job-listing/',
  jobsProxyUrl: 'https://www.htcinc.com/wp-content/themes/himalayas-child/job-api-proxy.php',
  verifiedSampleJobUrl: 'https://www.htcinc.com/job-detail/?jobcode=243561',
  companyDomain: 'htcinc.com',
  verifiedPublicJobCount: 19,
  verifiedIndiaJobCount: 17,
  atsPlatform: 'official-company-careers-proxy-json',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-pages-plus-single-first-party-proxy-response',
  extractionStrategy:
    'verified-careers-landing+verified-jobs-listing-page+first-party-jobs-proxy+india-location-filter+detail-apply-route-canonicalization',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: '../../scraper/htcglobalservices/script.js',
  dryRunFile: 'htcglobalservices/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default HTC_GLOBAL_SERVICES_CATALOG

