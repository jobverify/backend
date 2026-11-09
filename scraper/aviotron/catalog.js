import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AVIOTRON_CATALOG = {
  source: 'aviotron',
  companyName: 'Aviotron',
  officialBrandName: 'Aviotron',
  adapter: 'script',
  companyCareerPage: 'https://aviotron.com/',
  homepageUrl: 'https://aviotron.com/',
  robotsTxtUrl: 'https://aviotron.com/robots.txt',
  sitemapUrl: 'https://aviotron.com/sitemap.xml',
  noPublicJobRouteUrls: [
    'https://aviotron.com/careers',
    'https://aviotron.com/career',
    'https://aviotron.com/join-us',
    'https://aviotron.com/work-with-us',
    'https://aviotron.com/openings',
  ],
  untrustedJobRouteUrl: 'https://aviotron.com/jobs',
  companyDomain: 'aviotron.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-placeholder-homepage-plus-robots-and-sitemap-plus-common-careers-route-validation',
  extractionStrategy:
    'verified-launching-soon-homepage+verified-robots-and-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that direct requests from this runtime to https://aviotron.com/, https://aviotron.com/robots.txt, https://aviotron.com/sitemap.xml, and the verified no-public-careers routes currently fail with UND_ERR_CONNECT_TIMEOUT before the trusted first-party Aviotron surfaces can render. The scraper preserves the previously verified GoDaddy-style Launching Soon homepage, robots.txt, sitemap, and branded 404 route validation whenever those trusted surfaces are reachable again, and now returns an authoritative empty result while they remain temporarily unreachable from this environment.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AVIOTRON_CATALOG
