import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on September 3, 2026 that https://www.fylehq.com/ is the live first-party homepage, that its Careers link points to the join page at https://www.fylehq.com/company/team/join, and that https://www.fylehq.com/careers resolves to that same first-party join page. Verified that https://www.fylehq.com/robots.txt and https://www.fylehq.com/sitemap.xml are live crawl surfaces; robots.txt now declares https://www.fylehq.com/sitemap-index.xml, and the concrete sitemap exposes https://www.fylehq.com/company/team/join as the only career-like URL. There is no trustworthy public jobs surface: the join page is a recruiting culture shell with no public job cards, ATS handoff, or structured JobPosting markup, while alternate first-party routes such as https://www.fylehq.com/career, https://www.fylehq.com/jobs, https://www.fylehq.com/join-us, https://www.fylehq.com/about/careers, https://www.fylehq.com/company/careers, https://www.fylehq.com/openings, https://www.fylehq.com/work-with-us, and https://www.fylehq.com/current-openings returned first-party 404 pages during live checks.'

export const FYLE_CATALOG = {
  source: 'fyle',
  companyName: 'Fyle',
  officialBrandName: 'Sage Expense Management (formerly Fyle)',
  adapter: 'script',
  homepageUrl: 'https://www.fylehq.com/',
  companyCareerPage: 'https://www.fylehq.com/careers',
  resolvedCareerPageUrl: 'https://www.fylehq.com/company/team/join',
  robotsTxtUrl: 'https://www.fylehq.com/robots.txt',
  sitemapUrl: 'https://www.fylehq.com/sitemap.xml',
  checkedMissingRouteUrls: [
    'https://www.fylehq.com/career',
    'https://www.fylehq.com/jobs',
    'https://www.fylehq.com/join-us',
    'https://www.fylehq.com/about/careers',
    'https://www.fylehq.com/company/careers',
    'https://www.fylehq.com/openings',
    'https://www.fylehq.com/work-with-us',
    'https://www.fylehq.com/current-openings',
  ],
  companyDomain: 'fylehq.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-redirect-shell-plus-robots-sitemap-and-404-route-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-redirect-shell-without-public-listings+verified-sitemap-single-careers-shell+verified-missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'fyle/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FYLE_CATALOG
