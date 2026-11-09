import {
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
} from './script.js'

export const provider = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/aandbglobal/script.js',
  companyCareerPage: HOMEPAGE_URL,
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-work-with-us-anchor-plus-sitemap-plus-common-route-validation',
  extractionStrategy:
    'verified-homepage+verified-work-with-us-partner-popup+verified-single-homepage-sitemap+missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'aandbglobal.com',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified https://aandbglobal.com/ and https://aandbglobal.com/wp-sitemap-posts-page-1.xml on July 14, 2026. There is no trustworthy public jobs surface: the official first-party site exposes a homepage-only education consultancy with a "Join with Us as A Partner" popup, while common careers and jobs routes return first-party 404 pages rather than structured openings.',
}

export default provider

