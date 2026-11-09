import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const V2SOFT_CATALOG = {
  source: 'v2soft',
  companyName: 'V2soft',
  officialBrandName: 'V2Soft',
  adapter: 'script',
  homepageUrl: 'https://www.v2soft.com/',
  companyCareerPage: 'https://marketing.v2soft.com/india-careers/',
  atsPlatform: 'official-company-careers-inline-listing-and-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-detail-pages',
  extractionStrategy:
    'verified-india-careers-page+first-party-view-job-links+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'v2soft.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://marketing.v2soft.com/india-careers/ remained the live first-party V2Soft India careers page, surfaced inline openings including Hadoop + Java, Digital Marketing Lead, and Mobile Developer, and linked each role to same-domain first-party detail pages under marketing.v2soft.com/india-careers/.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.resolve(currentDir, 'jobs.json'),
}

export default V2SOFT_CATALOG
