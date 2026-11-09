import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HEX_CATALOG = {
  source: 'hex',
  companyName: 'Hex',
  officialBrandName: 'Hex',
  adapter: 'script',
  homepageUrl: 'https://hex.tech/',
  companyCareerPage: 'https://hex.tech/careers/',
  sampleRoleUrls: [
    'https://hex.tech/careers/software-engineer-backend-%28platform%29/',
    'https://hex.tech/careers/cloud-security-engineer/',
  ],
  atsPlatform: 'first-party-careers-page-us-only-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-page-complete-inventory',
  extractionStrategy: 'verified-first-party-role-cards+complete-count+us-only-locations',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'hex.tech',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://hex.tech/careers/ exposed 36 first-party role cards and a matching public total. Every listed location was San Francisco, New York, or Remote - US, including Software Engineer, Backend (Platform) at https://hex.tech/careers/software-engineer-backend-%28platform%29/ and Cloud Security Engineer at https://hex.tech/careers/cloud-security-engineer/. No India-eligible openings were listed; the scraper checks every card and fails closed if this changes.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HEX_CATALOG
