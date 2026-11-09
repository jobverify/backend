import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DECIMAL_TECHNOLOGIES_CATALOG = {
  source: 'decimaltechnologies',
  companyName: 'Decimal Technologies',
  officialBrandName: 'Decimal Technologies',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://decimaltech.com/',
  companyDomain: 'decimaltech.com',
  robotsTxtUrl: 'https://decimaltech.com/robots.txt',
  sitemapUrl: 'https://decimaltech.com/sitemap.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-common-careers-routes-plus-sitemap-validation',
  extractionStrategy: 'verified-homepage+verified-common-careers-404s+verified-sitemap-no-careers-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://decimaltech.com/ is the live Decimal Technologies homepage, that common exact-name careers routes including /careers, /career, /jobs, /join-us, and /company/careers all returned 404, and that https://decimaltech.com/sitemap.xml did not advertise any careers or jobs URL. The first-party culture page at https://decimaltech.com/company/culture-and-values describes employee culture but exposes no public jobs surface. There is no trustworthy public jobs board on the verified date, so this company stays fail-closed.',
}

export default DECIMAL_TECHNOLOGIES_CATALOG
