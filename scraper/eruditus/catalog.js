import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the canonical Eruditus homepage at https://eruditus.com/ is live, that https://eruditus.com/robots.txt advertises the Yoast sitemap index at https://eruditus.com/sitemap_index.xml, that https://eruditus.com/page-sitemap.xml publicly lists first-party pages such as https://eruditus.com/about-us/ and https://eruditus.com/contact-us/ but does not publish any careers or jobs route, and that https://eruditus.com/careers, https://eruditus.com/career, https://eruditus.com/jobs, https://eruditus.com/join-us, and https://eruditus.com/work-with-us each returned first-party 404 pages. The verified homepage footer publishes About Us, Universities, Enterprise, Indian Institutions, Newsroom, Policies, Privacy Policy, Cookie Policy, and Contact Us links, but no trustworthy public careers or ATS handoff. No trustworthy public jobs surface was exposed for Eruditus during live verification. Canonical homepage: https://eruditus.com/'

export const ERUDITUS_CATALOG = {
  source: 'eruditus',
  companyName: 'Eruditus',
  officialBrandName: 'Eruditus Executive Education',
  adapter: 'script',
  homepageUrl: 'https://eruditus.com/',
  companyCareerPage: 'https://eruditus.com/careers',
  careerPageUrl: 'https://eruditus.com/careers',
  aboutUsUrl: 'https://eruditus.com/about-us/',
  robotsTxtUrl: 'https://eruditus.com/robots.txt',
  sitemapUrl: 'https://eruditus.com/sitemap.xml',
  sitemapIndexUrl: 'https://eruditus.com/sitemap_index.xml',
  pageSitemapUrl: 'https://eruditus.com/page-sitemap.xml',
  checked404RouteUrls: [
    'https://eruditus.com/careers',
    'https://eruditus.com/career',
    'https://eruditus.com/jobs',
    'https://eruditus.com/join-us',
    'https://eruditus.com/work-with-us',
  ],
  companyDomain: 'eruditus.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'validated-homepage-plus-robots-and-page-sitemap-plus-common-404-careers-routes',
  extractionStrategy:
    'verified-homepage-without-careers-link+verified-robots-and-page-sitemap-without-careers-route+verified-common-careers-routes-return-404+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'eruditus/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ERUDITUS_CATALOG
