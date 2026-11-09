import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAFEEXPRESS_CATALOG = {
  source: 'safeexpress',
  companyName: 'SafeExpress',
  officialBrandName: 'SAFE EXPRESS',
  adapter: 'script',
  homepageUrl: 'https://www.safeexpress.in/',
  companyCareerPage: 'https://www.safeexpress.in/',
  verifiedContactPageUrl: 'https://www.safeexpress.in/contact.html',
  companyDomain: 'safeexpress.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'static-homepage-plus-contact-page-validation',
  extractionStrategy: 'verified-homepage+verified-contact-page+no-public-careers-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.safeexpress.in/ is the official exact-name SafeExpress site and that https://www.safeexpress.in/contact.html is the matching first-party contact page. The first-party navigation exposes Home, About, Services, Contact, and Track your Cargo, while the verified pages describe a customs clearing and forwarding business and expose no trustworthy public jobs surface, careers page, or current openings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'safeexpress/jobs.json',
}

export default SAFEEXPRESS_CATALOG
