import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on September 3, 2026 that https://www.freshtohome.com/ is the live first-party FreshToHome homepage, that https://www.freshtohome.com/robots.txt and https://www.freshtohome.com/sitemap/sitemap.xml are live first-party crawl surfaces, and that the sitemap lists product/category URLs rather than careers URLs. There is no trustworthy public jobs surface: the homepage exposed no first-party careers link or public ATS handoff, and common first-party careers routes such as https://www.freshtohome.com/careers, https://www.freshtohome.com/career, https://www.freshtohome.com/jobs, https://www.freshtohome.com/join-us, https://www.freshtohome.com/work-with-us, https://www.freshtohome.com/openings, and https://www.freshtohome.com/current-openings all returned first-party 404 pages during live checks.'

export const FRESHTOHOME_CATALOG = {
  source: 'freshtohome',
  companyName: 'FreshToHome',
  officialBrandName: 'FreshToHome',
  adapter: 'script',
  homepageUrl: 'https://www.freshtohome.com/',
  companyCareerPage: 'https://www.freshtohome.com/',
  robotsTxtUrl: 'https://www.freshtohome.com/robots.txt',
  sitemapUrl: 'https://www.freshtohome.com/sitemap/sitemap.xml',
  checkedMissingRouteUrls: [
    'https://www.freshtohome.com/careers',
    'https://www.freshtohome.com/career',
    'https://www.freshtohome.com/jobs',
    'https://www.freshtohome.com/join-us',
    'https://www.freshtohome.com/work-with-us',
    'https://www.freshtohome.com/openings',
    'https://www.freshtohome.com/current-openings',
  ],
  companyDomain: 'freshtohome.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-robots-and-sitemap-plus-common-careers-route-404-validation',
  extractionStrategy:
    'verified-homepage+verified-robots-and-sitemap-without-careers-url+verified-missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'freshtohome/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FRESHTOHOME_CATALOG
