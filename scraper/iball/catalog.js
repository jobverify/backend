import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IBALL_CATALOG = {
  source: 'iball',
  companyName: 'iBall',
  officialBrandName: 'iBall',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://iball.co.in/',
  officialHomepageUrl: 'https://iball.co.in/',
  officialAboutUrl: 'https://iball.co.in/pages/about-us',
  officialNewsCenterUrl: 'https://iball.co.in/blogs/news-center',
  commonCareerRoutes: [
    'https://iball.co.in/pages/careers',
    'https://iball.co.in/pages/career',
    'https://iball.co.in/careers',
    'https://iball.co.in/jobs',
    'https://iball.co.in/join-us',
  ],
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-about-plus-news-center-plus-common-careers-route-validation',
  extractionStrategy:
    'verified-brand-homepage+verified-about-page+verified-news-center+verified-missing-or-non-job-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'iball.co.in',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://iball.co.in/ is the live first-party iBall site, that https://iball.co.in/pages/about-us and https://iball.co.in/blogs/news-center are live official brand pages, and that candidate first-party careers routes https://iball.co.in/pages/careers, https://iball.co.in/pages/career, https://iball.co.in/careers, https://iball.co.in/jobs, and https://iball.co.in/join-us returned first-party 404s during live checks. There is no trustworthy public jobs surface, ATS handoff, or structured public openings surface for iBall on the verified date.',
  dryRunFile: 'iball/jobs.json',
}

export default IBALL_CATALOG
