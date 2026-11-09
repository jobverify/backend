import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APTECH_CATALOG = {
  source: 'aptech',
  companyName: 'Aptech',
  officialBrandName: 'Aptech Limited',
  adapter: 'script',
  homepageUrl: 'https://www.aptech-worldwide.com/',
  companyCareerPage: 'https://www.aptech-worldwide.com/careers-with-aptech',
  careersApiUrl: 'https://api.aptech-worldwide.com/careers/getlist',
  sitemapUrl: 'https://www.aptech-worldwide.com/sitemap.xml',
  companyDomain: 'aptech-worldwide.com',
  atsPlatform: 'first-party-careers-api',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-api-feed',
  extractionStrategy:
    'verified-first-party-careers-route+verified-first-party-bundle-api-handoff+first-party-careers-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.aptech-worldwide.com/ is the live first-party Aptech Limited site, that https://www.aptech-worldwide.com/sitemap.xml advertises the public careers route at https://www.aptech-worldwide.com/careers-with-aptech, and that the first-party careers route ships the careers bundle that calls the first-party API https://api.aptech-worldwide.com/careers/getlist. Live verification on July 15, 2026 found the public API returning 11 active vacancies whose applications currently hand off by email to careers@aptech.co.in.',
  dryRunFile: 'aptech/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default APTECH_CATALOG
