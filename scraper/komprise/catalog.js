import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_JOB_DETAIL_URLS = [
  'https://www.komprise.com/job/account-executive/',
  'https://www.komprise.com/job/ux-designer/',
  'https://www.komprise.com/job/software-development-engineer-test/',
]

const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.komprise.com/careers/ remains the current first-party Komprise careers page and that https://www.komprise.com/job_listing-sitemap.xml publishes account-executive, ux-designer, and software-development-engineer-test. The UX Designer and Software Development Engineer in Test detail pages identify Bengaluru and provide the first-party India email apply flow via india_careers@komprise.com.'

export const KOMPRISE_CATALOG = {
  source: 'komprise',
  companyName: 'Komprise',
  officialBrandName: 'Komprise',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.komprise.com/',
  companyCareerPage: 'https://www.komprise.com/careers/',
  sitemapIndexUrl: 'https://www.komprise.com/sitemap_index.xml',
  jobListingSitemapUrl: 'https://www.komprise.com/job_listing-sitemap.xml',
  verifiedJobDetailUrls: VERIFIED_JOB_DETAIL_URLS,
  companyDomain: 'komprise.com',
  atsPlatform: 'wp-job-manager',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-yoast-job-listing-sitemap',
  extractionStrategy: 'verified-careers-page+job-listing-sitemap+wp-job-manager-detail-pages+india-role-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default KOMPRISE_CATALOG
