import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MONEYCONTROL_CATALOG = {
  source: 'moneycontrol',
  companyName: 'Moneycontrol',
  officialBrandName: 'Moneycontrol',
  adapter: 'script',
  companyCareerPage: 'https://www.moneycontrol.com/career/?classic=true',
  officialContactPageUrl: 'https://www.moneycontrol.com/cdata/contact.php?classic=true',
  blockedCareersRouteUrls: [
    'https://www.moneycontrol.com/career/?classic=true',
    'https://www.moneycontrol.com/career/',
  ],
  companyDomain: 'moneycontrol.com',
  atsPlatform: 'official-contact-page-plus-blocked-careers-route',
  countryFilter: 'India',
  paginationStrategy: 'official-contact-page-plus-blocked-careers-route-validation',
  extractionStrategy: 'verified-contact-page-careers-link+blocked-careers-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on July 19, 2026 that the official Moneycontrol contact page at https://www.moneycontrol.com/cdata/contact.php?classic=true still links job seekers to https://www.moneycontrol.com/career/?classic=true as "Current jobs at Moneycontrol", but both https://www.moneycontrol.com/career/?classic=true and https://www.moneycontrol.com/career/ returned first-party 503 Akamai error pages rather than a trustworthy public jobs surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MONEYCONTROL_CATALOG
