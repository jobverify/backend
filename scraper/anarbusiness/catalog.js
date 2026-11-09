import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.anar.biz/ displays the first-party Anar shutdown message and its former /career, /careers, /jobs, /join-us, and /work-with-us routes return HTTP 410 with the same message. No public Anar jobs surface is available.'

export const ANAR_BUSINESS_CATALOG = {
  source: 'anarbusiness',
  companyName: 'Anar Business',
  officialBrandName: 'Anar',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.anar.biz/',
  homepageUrl: 'https://www.anar.biz/',
  companyDomain: 'anar.biz',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'shutdown-homepage-plus-retired-route-validation',
  extractionStrategy: 'verified-first-party-shutdown+verified-retired-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedMissingCareersUrls: [
    'https://www.anar.biz/career',
    'https://www.anar.biz/careers',
    'https://www.anar.biz/jobs',
    'https://www.anar.biz/join-us',
    'https://www.anar.biz/work-with-us',
  ],
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ANAR_BUSINESS_CATALOG
