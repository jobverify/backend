import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OYO_CATALOG = {
  source: 'oyo',
  companyName: 'OYO',
  officialBrandName: 'OYO',
  adapter: 'script',
  homepageUrl: 'https://www.oyorooms.com/',
  companyCareerPage: 'https://www.oyorooms.com/careers',
  officialCareersPageUrl: 'https://www.oyorooms.com/careers',
  linkedinCareersUrl: 'https://www.linkedin.com/company/oyo-rooms/jobs/',
  companyDomain: 'oyorooms.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-footer-link-plus-non-jobs-careers-route-validation',
  extractionStrategy: 'verified-homepage-linkedin-handoff+verified-non-jobs-careers-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the official OYO homepage at https://www.oyorooms.com/ exposed a footer-style Teams / Careers link pointing to https://www.linkedin.com/company/oyo-rooms/jobs/, while the exact-name route https://www.oyorooms.com/careers resolved to a non-jobs consumer booking surface rather than a first-party hiring board. There was no trustworthy first-party public jobs surface on the exact-name OYO domain during verification, so this provider is pinned as a fail-closed sentinel until a real first-party careers board reappears.',
  dryRunFile: 'oyo/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default OYO_CATALOG
