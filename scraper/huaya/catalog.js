export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.huayaba.com/ is the live first-party Huaya homepage for Hebei Huaya Co., Ltd., that https://www.huayaba.com/about/ is the matching first-party company profile page, and that https://www.huayaba.com/sitemap_index.xml exposes the site sitemap. Across those verified first-party surfaces there were no trustworthy public job listings, careers routes, ATS links, or JobPosting markup, so the scraper returns an empty array until a real public jobs surface appears.'

export const HUAYA_CATALOG = {
  source: 'huaya',
  companyName: 'Huaya',
  officialBrandName: 'Hebei Huaya Co., Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.huayaba.com/',
  companyCareerPage: 'https://www.huayaba.com/',
  aboutPageUrl: 'https://www.huayaba.com/about/',
  sitemapUrl: 'https://www.huayaba.com/sitemap_index.xml',
  companyDomain: 'huayaba.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-about-page-plus-sitemap-validation',
  extractionStrategy:
    'verified-homepage+verified-about-page+verified-sitemap-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: '../../scraper/huaya/script.js',
  dryRunFile: 'huaya/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default HUAYA_CATALOG

