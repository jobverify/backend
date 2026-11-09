import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "The current https://avglogistics.com/careers advertises Easily apply to multiple jobs with one click but renders an empty comment-only row. This is an observed configured panel with no reviewed native vacancy model, explicit count or empty-state assertion, so vacancy/India totals remain unknown. Opening/closing panel evidence never depends on guessed routes, robots/sitemaps, operational login or company-wide absence."

export const AVG_LOGISTICS_CATALOG = {
  source: 'avglogistics',
  companyName: 'AVG Logistics',
  officialBrandName: 'AVG Logistics Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'avglogistics/jobs.json',
  companyCareerPage: 'https://avglogistics.com/careers',
  homepageUrl: 'https://avglogistics.com/',
  robotsTxtUrl: 'https://avglogistics.com/robots.txt',
  sitemapUrl: 'https://www.avglogistics.com/sitemap.xml',
  noPublicJobRouteUrls: [
    'https://avglogistics.com/jobs',
    'https://avglogistics.com/job',
    'https://avglogistics.com/current-openings',
    'https://avglogistics.com/openings',
    'https://avglogistics.com/work-with-us',
    'https://avglogistics.com/join-us',
  ],
  operationsPortalUrl: 'https://avglogistics.in/',
  operationsPortalCareersUrl: 'https://avglogistics.in/careers',
  companyDomain: 'avglogistics.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: "opening-and-closing-current-configured-public-surface",
  extractionStrategy:
    "current-employer-public-intake-or-unqualified-panel-observations;unknown-native-inventory",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AVG_LOGISTICS_CATALOG
