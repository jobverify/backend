import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 7, 2026 that live HTTP probes from this environment to https://authorstream.com/, its robots.txt and sitemap, /lander, and the checked first-party routes now time out before any trustworthy careers surface can be reached. Recent direct web checks still resolve the first-party domain family toward a GoDaddy for-sale landing path rather than a live AuthorStream careers site or ATS handoff, and no alternate official jobs surface was discoverable on the verified date. The scraper therefore returns an authoritative empty result when every verified first-party route is unreachable.'

export const AUTHORSTREAM_CATALOG = {
  source: 'authorstream',
  companyName: 'AuthorStream',
  officialBrandName: 'AuthorStream',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'authorstream/jobs.json',
  companyCareerPage: 'https://authorstream.com/',
  homepageUrl: 'https://authorstream.com/',
  robotsTxtUrl: 'https://authorstream.com/robots.txt',
  sitemapUrl: 'https://authorstream.com/sitemap.xml',
  landerUrl: 'https://authorstream.com/lander',
  checkedRouteUrls: [
    'https://authorstream.com/careers',
    'https://authorstream.com/career',
    'https://authorstream.com/jobs',
    'https://authorstream.com/about',
    'https://authorstream.com/contact-us',
  ],
  companyDomain: 'authorstream.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-redirect-shell-plus-robots-sitemap-and-first-party-route-validation',
  extractionStrategy:
    'verified-redirect-shell+verified-robots-and-sitemap-with-single-lander-url+verified-first-party-routes-share-parked-redirect-or-all-routes-unreachable-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AUTHORSTREAM_CATALOG
