import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FRAGMA_DATA_SYSTEMS_CATALOG = {
  source: 'fragmadatasystems',
  companyName: 'Fragma Data Systems',
  officialBrandName: 'Fragma Data',
  adapter: 'script',
  homepageUrl: 'https://fragmadata.com/',
  companyCareerPage: 'https://fragmadata.com/careers/',
  companyDomain: 'fragmadata.com',
  atsPlatform: 'first-party-homepage-careers-email-only',
  countryFilter: 'India',
  paginationStrategy: 'homepage-careers-email-plus-missing-careers-route',
  extractionStrategy:
    'verified-homepage-careers-email-only+verified-404-careers-route+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://fragmadata.com/ remained the first-party Fragma Data homepage, that it exposed only the careers@fragmadata.com contact for Careers/Job Enquiry, and that https://fragmadata.com/careers/ returned Page not found rather than a trustworthy public jobs listing, so this provider remains fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'fragmadatasystems/jobs.json',
}

export default FRAGMA_DATA_SYSTEMS_CATALOG
