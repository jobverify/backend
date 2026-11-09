export const provider = {
  source: 'aavishkar',
  companyName: 'Aavishkar',
  officialBrandName: 'Aavishkaar Group',
  adapter: 'script',
  modulePath: '../../scraper/aavishkar/script.js',
  companyCareerPage: 'https://aavishkaargroup.com/',
  companyDomain: 'aavishkaargroup.com',
  contactPageUrl: 'https://aavishkaargroup.com/contact-us/',
  robotsTxtUrl: 'https://aavishkaargroup.com/robots.txt',
  sitemapUrl: 'https://aavishkaargroup.com/sitemap.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-plus-robots-plus-sitemap-plus-common-careers-404-validation',
  extractionStrategy:
    'verified-group-homepage+verified-contact-page+verified-robots-and-sitemap+verified-missing-first-party-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that https://aavishkaargroup.com/ is the live Aavishkaar Group first-party site for the backlog row Aavishkar, https://aavishkaargroup.com/contact-us/ is the live contact page, robots.txt and the Yoast sitemap index expose only first-party informational routes, and common careers or jobs routes return first-party 404 pages. No trustworthy public jobs surface is currently exposed.',
  dryRunFile: 'aavishkar/jobs.json',
}

export default provider

