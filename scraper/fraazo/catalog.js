import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FRAAZO_CATALOG = {
  source: 'fraazo',
  companyName: 'Fraazo',
  officialBrandName: 'Fraazo',
  adapter: 'script',
  homepageUrl: 'https://fraazo.com/',
  wwwHomepageUrl: 'https://www.fraazo.com/',
  companyCareerPage: 'https://fraazo.com/careers',
  wwwCareerPageUrl: 'https://www.fraazo.com/careers',
  jobsUrl: 'https://fraazo.com/jobs',
  wwwJobsUrl: 'https://www.fraazo.com/jobs',
  robotsUrl: 'https://fraazo.com/robots.txt',
  wwwRobotsUrl: 'https://www.fraazo.com/robots.txt',
  sitemapUrl: 'https://fraazo.com/sitemap.xml',
  wwwSitemapUrl: 'https://www.fraazo.com/sitemap.xml',
  timeoutProbeUrls: [
    'https://fraazo.com/',
    'https://www.fraazo.com/',
    'https://fraazo.com/careers',
    'https://www.fraazo.com/careers',
    'https://fraazo.com/career',
    'https://www.fraazo.com/career',
    'https://fraazo.com/jobs',
    'https://www.fraazo.com/jobs',
    'https://fraazo.com/join-us',
    'https://www.fraazo.com/join-us',
    'https://fraazo.com/openings',
    'https://www.fraazo.com/openings',
    'https://fraazo.com/work-with-us',
    'https://www.fraazo.com/work-with-us',
    'https://fraazo.com/robots.txt',
    'https://www.fraazo.com/robots.txt',
    'https://fraazo.com/sitemap.xml',
    'https://www.fraazo.com/sitemap.xml',
  ],
  companyDomain: 'fraazo.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-home-careers-and-discovery-route-timeout-validation',
  extractionStrategy:
    'verified-homepage-timeouts+verified-careers-route-timeouts+verified-robots-and-sitemap-timeouts-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that direct first-party fetches to https://fraazo.com/, https://www.fraazo.com/, https://fraazo.com/careers, https://www.fraazo.com/careers, https://fraazo.com/career, https://www.fraazo.com/career, https://fraazo.com/jobs, https://www.fraazo.com/jobs, https://fraazo.com/join-us, https://www.fraazo.com/join-us, https://fraazo.com/openings, https://www.fraazo.com/openings, https://fraazo.com/work-with-us, https://www.fraazo.com/work-with-us, https://fraazo.com/robots.txt, https://www.fraazo.com/robots.txt, https://fraazo.com/sitemap.xml, and https://www.fraazo.com/sitemap.xml all timed out from the verified environment instead of exposing a reachable first-party homepage, careers shell, sitemap, robots file, ATS handoff, or public jobs listing. No trustworthy public jobs surface was verifiable for Fraazo on the first-party domain at the verified date.',
  dryRunFile: 'fraazo/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FRAAZO_CATALOG
