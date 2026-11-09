import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IFLEXION_CATALOG = {
  source: 'iflexion',
  companyName: 'Iflexion',
  officialBrandName: 'Iflexion',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.iflexion.com/',
  homepageUrl: 'https://www.iflexion.com/',
  sitemapUrl: 'https://www.iflexion.com/sitemap.xml',
  noPublicJobRouteUrls: [
    'https://www.iflexion.com/careers',
    'https://www.iflexion.com/careers/',
    'https://www.iflexion.com/jobs',
    'https://www.iflexion.com/jobs/',
    'https://www.iflexion.com/careers-and-jobs',
  ],
  companyDomain: 'iflexion.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-sitemap-plus-common-job-route-validation',
  extractionStrategy:
    'verified-first-party-marketing-site+verified-sitemap-without-careers+verified-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'iflexion/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.iflexion.com/ is the live first-party Iflexion marketing homepage and https://www.iflexion.com/sitemap.xml publishes service, portfolio, blog, and other marketing URLs but no first-party careers route, ATS handoff, or public jobs listing page. Also verified that common careers endpoints on the official domain including https://www.iflexion.com/careers, https://www.iflexion.com/careers/, https://www.iflexion.com/jobs, https://www.iflexion.com/jobs/, and https://www.iflexion.com/careers-and-jobs return 404 Page not found responses. The only sitemap URL containing "jobs" is a blog article, not a careers surface. There is no trustworthy public jobs surface to scrape.',
}

export default IFLEXION_CATALOG
