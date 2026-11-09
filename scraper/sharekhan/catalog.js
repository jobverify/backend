import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.sharekhan.com/careers is the live official Sharekhan careers page, that it exposes a first-party inline openings table with public detail routes under /careers/job-details/, and that the live table currently includes Senior Manager - Campaign Management, Manager Digital Marketing, and UI/UX Designer. Verified a live first-party sample detail page at https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029.'

export const SHAREKHAN_CATALOG = {
  source: 'sharekhan',
  companyName: 'Sharekhan',
  officialBrandName: 'Mirae Asset Sharekhan',
  adapter: 'script',
  homepageUrl: 'https://www.sharekhan.com/',
  companyCareerPage: 'https://www.sharekhan.com/careers',
  companyDomain: 'sharekhan.com',
  listingTableUrl: 'https://www.sharekhan.com/careers',
  verifiedSampleJobUrl:
    'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
  atsPlatform: 'official-company-careers-inline-job-table',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-table-plus-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+inline-job-table+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'sharekhan/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SHAREKHAN_CATALOG
