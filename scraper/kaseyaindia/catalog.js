export const KASEYA_INDIA_CATALOG = {
  source: 'kaseyaindia',
  companyName: 'Kaseya India',
  officialBrandName: 'Kaseya',
  adapter: 'script',
  modulePath: '../../scraper/kaseyaindia/script.js',
  dryRunFile: 'kaseyaindia/jobs.json',
  homepageUrl: 'https://www.kaseya.com/careers/jobs/',
  companyCareerPage: 'https://www.kaseya.com/careers/jobs/',
  greenhouseEmbedScriptUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=kaseya',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/kaseya/jobs',
  companyDomain: 'kaseya.com',
  verifiedSampleJobUrl: 'https://www.kaseya.com/careers/jobs/id/6015830004/',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  verifiedPublicJobCount: 261,
  paginationStrategy: 'verified-first-party-careers-page-plus-greenhouse-api',
  extractionStrategy: 'verified-first-party-careers-page+greenhouse-api+first-party-detail-urls',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.kaseya.com/careers/jobs/ is the live first-party Kaseya jobs page, that it still includes the @kaseya.com candidate-safety warning plus the Bengaluru campus hiring section, and that it now embeds the official Greenhouse board script at https://boards.greenhouse.io/embed/job_board/js?for=kaseya. Verified that the public Greenhouse jobs feed at https://boards-api.greenhouse.io/v1/boards/kaseya/jobs?content=true returns current first-party Kaseya detail URLs such as https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004 and exposes live India roles in Pune, Bangalore, and Remote India. The legacy https://www.kaseya.com/jobs-sitemap.xml route now returns a first-party 404 page, so this provider now trusts the first-party jobs page plus the verified Greenhouse feed instead of the retired sitemap.',
}

export default KASEYA_INDIA_CATALOG

