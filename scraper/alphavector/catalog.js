export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 7, 2026 that live HTTP probes from this environment to https://alphavector.co/, its robots.txt and sitemap, and the common first-party careers routes all timed out before a trustworthy careers surface could be reached. Those same first-party routes had already been verified earlier as a parked redirect shell pointing only toward /lander rather than a live careers site or ATS handoff, and no alternate official jobs surface was discoverable on the verified date. The scraper therefore keeps returning an authoritative empty result when every verified first-party route is unreachable.'

export const ALPHAVECTOR_CATALOG = {
  source: 'alphavector',
  companyName: 'Alphavector',
  adapter: 'script',
  modulePath: '../../scraper/alphavector/script.js',
  companyCareerPage: 'https://alphavector.co/',
  companyDomain: 'alphavector.co',
  robotsTxtUrl: 'https://alphavector.co/robots.txt',
  sitemapUrl: 'https://alphavector.co/sitemap.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-parked-homepage-plus-sitemap-plus-common-careers-route-redirect-validation',
  extractionStrategy:
    'verified-parked-homepage+verified-robots-and-sitemap-with-single-lander-url+verified-common-careers-routes-share-parked-redirect-or-all-routes-unreachable-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ALPHAVECTOR_CATALOG

