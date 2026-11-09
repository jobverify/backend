export const VERIFIED_SURFACE_SUMMARY =
  "Verified October 9, 2026: https://eko.in/ is the Eko Bharat Ventures Private Limited homepage and links https://about.eko.in/. Both captured first-party homepage responses have no public hiring signal or careers/ATS handoff; the corporate homepage is a client shell. https://eko.in/robots.txt and https://eko.in/sitemap.xml advertise no careers route, and https://about.eko.in/robots.txt disallows crawling. https://about.eko.in/sitemap.xml and twelve common /careers, /career, /jobs, /join-us, /work-with-us and /openings routes across both hosts return first-party 404 responses. These inspected surfaces establish incomplete discovery rather than a complete active vacancy inventory or an authoritative zero statement, so public and India vacancy counts remain unknown."

export const EKO_CATALOG = {
  source: 'eko',
  companyName: 'Eko',
  officialBrandName: 'Eko Bharat Ventures Private Limited',
  adapter: 'script',
  modulePath: '../../scraper/eko/script.js',
  companyCareerPage: 'https://eko.in/',
  companyDomain: 'eko.in',
  corporateHomepageUrl: 'https://about.eko.in/',
  robotsTxtUrl: 'https://eko.in/robots.txt',
  sitemapUrl: 'https://eko.in/sitemap.xml',
  corporateRobotsTxtUrl: 'https://about.eko.in/robots.txt',
  corporateSitemapUrl: 'https://about.eko.in/sitemap.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-corporate-homepage-plus-crawl-surface-plus-common-careers-route-validation',
  extractionStrategy:
    'verified-homepage+verified-corporate-homepage+verified-crawl-surfaces-without-careers+verified-missing-common-careers-routes+incomplete-discovery',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  zeroResultPolicy: 'discovery-only',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EKO_CATALOG

