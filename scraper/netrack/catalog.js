import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NETRACK_CATALOG = {
  source: 'netrack',
  companyName: 'Netrack',
  officialBrandName: 'NetRack Enclosures Private Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.netrackindia.com/en',
  companyCareerPage: 'https://www.netrackindia.com/en',
  contactUrl: 'https://www.netrackindia.com/en/contact-0',
  teamUrl: 'https://www.netrackindia.com/en/about-us/about-company/team',
  blockedRouteUrls: [
    'https://www.netrackindia.com/en',
    'https://www.netrackindia.com/en/contact-0',
    'https://www.netrackindia.com/en/about-us/about-company/team',
    'https://www.netrackindia.com/en/careers',
    'https://www.netrackindia.com/careers',
    'https://www.netrackindia.com/en/jobs',
    'https://www.netrackindia.com/jobs',
  ],
  companyDomain: 'netrackindia.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-first-party-informational-pages-plus-missing-common-careers-route-validation',
  extractionStrategy:
    'verified-first-party-informational-pages+missing-common-hiring-routes+no-trustworthy-public-jobs-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that the official exact-name first-party Netrack routes https://www.netrackindia.com/en, https://www.netrackindia.com/en/contact-0, and https://www.netrackindia.com/en/about-us/about-company/team returned stable first-party informational pages rather than a public careers surface. Verified that adjacent common hiring routes https://www.netrackindia.com/en/careers, https://www.netrackindia.com/careers, https://www.netrackindia.com/en/jobs, and https://www.netrackindia.com/jobs returned first-party 404 no-content responses. There is no trustworthy public jobs surface for Netrack on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NETRACK_CATALOG
