import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FLEETX_CATALOG = {
  source: 'fleetx',
  companyName: 'Fleetx',
  officialBrandName: 'Fleetx',
  adapter: 'script',
  homepageUrl: 'https://fleetx.io/',
  wwwHomepageUrl: 'https://www.fleetx.io/',
  companyCareerPage: 'https://fleetx.io/careers',
  wwwCareerPageUrl: 'https://www.fleetx.io/careers',
  robotsUrl: 'https://fleetx.io/robots.txt',
  wwwRobotsUrl: 'https://www.fleetx.io/robots.txt',
  sitemapUrl: 'https://fleetx.io/sitemap.xml',
  wwwSitemapUrl: 'https://www.fleetx.io/sitemap.xml',
  timeoutProbeUrls: [
    'https://fleetx.io/',
    'https://www.fleetx.io/',
    'https://fleetx.io/careers',
    'https://www.fleetx.io/careers',
    'https://fleetx.io/career',
    'https://www.fleetx.io/career',
    'https://fleetx.io/jobs',
    'https://www.fleetx.io/jobs',
    'https://fleetx.io/join-us',
    'https://www.fleetx.io/join-us',
    'https://fleetx.io/work-with-us',
    'https://www.fleetx.io/work-with-us',
    'https://fleetx.io/robots.txt',
    'https://www.fleetx.io/robots.txt',
    'https://fleetx.io/sitemap.xml',
    'https://www.fleetx.io/sitemap.xml',
  ],
  companyDomain: 'fleetx.io',
  atsPlatform: 'official-company-native-opening-cards',
  countryFilter: 'India',
  paginationStrategy:
    'paired-current-page-owned-client-records;company-scope-unqualified',
  extractionStrategy:
    'active-html+declared-client-literal-openings;country-and-full-criteria-unproven',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-05',
  verifiedSurfaceSummary:
    'Current native observations use https://www.fleetx.ai/careers and its active declared page component. All published card/client fields are retained, including unlabeled locations, without executing website code. Own country, full criteria, canonical role URLs, application activity, company scope and cleanup remain unproven. Historical fleetx.io routes and timeout helpers are diagnostic only; failed reads stop collection and never establish an empty inventory.',
  nativeCareersPage: 'https://www.fleetx.ai/careers',
  zeroResultPolicy: 'evidence-required',
  dryRunFile: 'fleetx/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FLEETX_CATALOG
