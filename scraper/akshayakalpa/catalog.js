import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AKSHAYAKALPA_CATALOG = {
  source: 'akshayakalpa',
  companyName: 'Akshayakalpa',
  officialBrandName: 'Akshayakalpa Organic',
  adapter: 'script',
  companyCareerPage: 'https://akshayakalpa.org/',
  companyDomain: 'akshayakalpa.org',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-crawl-surface-plus-common-careers-route-validation',
  extractionStrategy: 'verified-homepage+verified-crawl-surfaces-without-careers+verified-missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://akshayakalpa.org/ is the live first-party Akshayakalpa Organic homepage, that it does not expose a first-party careers or jobs link, that https://akshayakalpa.org/robots.txt, https://akshayakalpa.org/sitemap.xml, and https://akshayakalpa.org/page-sitemap.xml do not advertise any careers route, and that https://akshayakalpa.org/careers, https://akshayakalpa.org/careers/, https://akshayakalpa.org/career, https://akshayakalpa.org/jobs, https://akshayakalpa.org/join-us, https://akshayakalpa.org/work-with-us, and https://akshayakalpa.org/openings all returned first-party 404 pages. There is no trustworthy public jobs surface on the first-party Akshayakalpa domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AKSHAYAKALPA_CATALOG
