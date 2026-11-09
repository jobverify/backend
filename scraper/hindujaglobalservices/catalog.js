export const VERIFIED_SURFACE_SUMMARY =
  'Verified October 3, 2026: the HGS India landing and both category pages still link to their public RSS feeds. BPM RSS lists one Trainee Process Consultant role in Bangalore; Digital RSS exposes the ATS no-jobs sentinel and no active roles.'

export const HINDUJA_GLOBAL_SERVICES_CATALOG = {
  source: 'hindujaglobalservices',
  companyName: 'Hinduja Global Services',
  officialBrandName: 'Hinduja Global Solutions Ltd',
  adapter: 'script',
  modulePath: '../../scraper/hindujaglobalservices/script.js',
  dryRunFile: 'hindujaglobalservices/jobs.json',
  companyCareerPage: 'https://www.joinhgs.com/in/en',
  companyDomain: 'joinhgs.com',
  bpmCategoryPageUrl: 'https://careers.joinhgs.com/India/go/BPM-Jobs-India/7947010/',
  digitalCategoryPageUrl:
    'https://careers.joinhgs.com/India/go/Digital-Data-And-Analytics-Jobs-India/7947110/',
  bpmJobsRssUrl: 'https://careers.joinhgs.com/services/rss/category/?catid=7947010',
  digitalJobsRssUrl: 'https://careers.joinhgs.com/services/rss/category/?catid=7947110',
  verifiedSampleJobUrl:
    'https://careers.joinhgs.com/India/job/Bengaluru-Urban-Trainee-Process-Consultant-KA-560068/1367615866/',
  verifiedPublicJobCount: 1,
  verifiedIndiaJobCount: 1,
  atsPlatform: 'jobs2web-rss',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-landing-plus-linked-category-rss-feeds',
  extractionStrategy:
    'verified-joinhgs-landing+verified-category-pages+jobs2web-rss-feeds+india-job-normalization',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default HINDUJA_GLOBAL_SERVICES_CATALOG

