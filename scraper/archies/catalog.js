import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ARCHIES_CATALOG = {
  source: 'archies',
  companyName: 'Archies',
  officialBrandName: 'Archies Online',
  adapter: 'script',
  companyCareerPage: 'https://archiesonline.com/',
  companyDomain: 'archiesonline.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-crawl-surface-plus-common-careers-route-404-validation',
  extractionStrategy:
    'verified-homepage+verified-robots-and-page-sitemap-without-careers+verified-missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://archiesonline.com/ is the live first-party Archies Online storefront, that it does not expose a first-party careers or jobs link, that https://archiesonline.com/robots.txt, https://archiesonline.com/sitemap.xml, and https://archiesonline.com/sitemap_pages_1.xml?from=693794865301&to=710639354005 do not advertise any careers route, and that https://archiesonline.com/careers, https://archiesonline.com/career, https://archiesonline.com/jobs, https://archiesonline.com/join-us, https://archiesonline.com/work-with-us, and https://archiesonline.com/openings all returned first-party 404 pages. There is no trustworthy public jobs surface on the first-party Archies domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ARCHIES_CATALOG
