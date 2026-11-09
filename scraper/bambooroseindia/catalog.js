import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://bamboorose.com/ is the live first-party Bamboo Rose homepage, that https://bamboorose.com/careers/ is the live first-party careers page, that both View Current Openings buttons on the careers page hand applicants to https://www.linkedin.com/company/bamboorose/jobs/, that https://www.linkedin.com/company/bamboorose/jobs/ redirected to https://www.linkedin.com/company/bamboorose during anonymous verification, that https://bamboorose.com/jobs/, https://bamboorose.com/career/, https://bamboorose.com/join-us/, and https://bamboorose.com/openings/ returned first-party 404 pages, and that https://bamboorose.com/page-sitemap.xml published only https://bamboorose.com/careers/ as a career-like first-party URL. There is no trustworthy public jobs surface for Bamboo Rose India on the verified first-party domain.'

export const BAMBOO_ROSE_INDIA_CATALOG = {
  source: 'bambooroseindia',
  companyName: 'Bamboo Rose India',
  officialBrandName: 'Bamboo Rose',
  adapter: 'script',
  homepageUrl: 'https://bamboorose.com/',
  companyCareerPage: 'https://bamboorose.com/careers/',
  careerPageUrl: 'https://bamboorose.com/careers/',
  linkedinJobsUrl: 'https://www.linkedin.com/company/bamboorose/jobs/',
  sitemapIndexUrl: 'https://bamboorose.com/sitemap_index.xml',
  pageSitemapUrl: 'https://bamboorose.com/page-sitemap.xml',
  checkedMissingRouteUrls: [
    'https://bamboorose.com/jobs/',
    'https://bamboorose.com/career/',
    'https://bamboorose.com/join-us/',
    'https://bamboorose.com/openings/',
  ],
  companyDomain: 'bamboorose.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-page-plus-common-route-404-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-linkedin-handoff+verified-missing-common-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'bambooroseindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BAMBOO_ROSE_INDIA_CATALOG
