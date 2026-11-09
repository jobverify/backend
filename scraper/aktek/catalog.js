export const VERIFIED_SURFACE_SUMMARY =
  'Observed on November 6, 2026 that https://aktek.io/ is the official AKTEK homepage and https://aktek.io/robots.txt declares https://aktek.io/sitemap_index.xml. The current sitemap index contains post and page sections; https://aktek.io/page-sitemap.xml contains no configured careers route. These corporate crawl documents do not establish a complete vacancy inventory or zero company/India openings. No trustworthy public jobs surface has been qualified; lifecycle cleanup remains disallowed.'

export const AKTEK_CATALOG = {
  source: 'aktek',
  companyName: 'Aktek',
  adapter: 'script',
  modulePath: '../../scraper/aktek/script.js',
  companyCareerPage: 'https://aktek.io/',
  companyDomain: 'aktek.io',
  robotsTxtUrl: 'https://aktek.io/robots.txt',
  sitemapIndexUrl: 'https://aktek.io/sitemap_index.xml',
  pageSitemapUrl: 'https://aktek.io/page-sitemap.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'bounded-homepage-and-declared-crawl-discovery',
  extractionStrategy:
    'qualified-corporate-crawl-documents-return-explicit-incomplete-inventory-evidence',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  sourceScopeComplete: false,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AKTEK_CATALOG

