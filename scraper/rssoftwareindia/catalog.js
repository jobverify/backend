import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RS_SOFTWARE_INDIA_CATALOG = {
  source: 'rssoftwareindia',
  companyName: 'RS Software (India) Ltd.',
  officialBrandName: 'RS Software',
  adapter: 'script',
  homepageUrl: 'https://www.rssoftware.com/',
  companyCareerPage: 'https://www.rssoftware.com/home/jointeam',
  atsPlatform: 'official-current-rssoftware-ai-role-details-country-unqualified',
  countryFilter: 'India',
  paginationStrategy: 'current-own-home-jointeam-role-details-opening-closing',
  extractionStrategy: 'whole-current-rssoftware-ai-native-role-criteria-date-header-and-form-binding+work-country-and-company-scope-held',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'rssoftware.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.rssoftware.com/home/jointeam was the live first-party RS Software join-team page and that it publicly listed open roles including Global Delivery Head, Global Pre-sales Solution Engineer (Payments), Senior Manager Sales, Mumbai, Sales Director, US, and Senior Manager Sales, Bangalore/Chennai alongside the same-page resume submission surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'rssoftwareindia/jobs.json',
}

export default RS_SOFTWARE_INDIA_CATALOG
