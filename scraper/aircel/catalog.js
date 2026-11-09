import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AIRCEL_CATALOG = {
  source: 'aircel',
  companyName: 'Aircel',
  adapter: 'script',
  companyCareerPage: 'https://aircel.com/',
  companyDomain: 'aircel.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-common-careers-and-crawl-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-missing-careers-and-crawl-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://aircel.com/ is the live first-party Aircel homepage with the title "Aircel - Moile Service Provider", the homepage exposes only the same-domain link to 0_webportal_2022/nclt.html, and https://aircel.com/careers, https://aircel.com/career, https://aircel.com/jobs, https://aircel.com/join-us, https://aircel.com/openings, https://aircel.com/robots.txt, and https://aircel.com/sitemap.xml all returned 404 during live checks. There is no trustworthy public jobs surface on the first-party Aircel domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AIRCEL_CATALOG
