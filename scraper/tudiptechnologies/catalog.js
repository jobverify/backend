import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TUDIP_TECHNOLOGIES_CATALOG = {
  source: 'tudiptechnologies',
  companyName: 'Tudip Technologies',
  officialBrandName: 'Tudip',
  adapter: 'script',
  homepageUrl: 'https://tudip.com/',
  companyCareerPage: 'https://tudip.com/jobs/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-page',
  extractionStrategy: 'verified-first-party-jobs-page+category-filtered-job-listings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'tudip.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://tudip.com/jobs/ remained the exact first-party Tudip jobs board, defaulted to the India tab, and publicly listed India openings including Korean Language Expert, Fullstack .Net Developer, Senior Data Analyst, Android Developer, and Data Analyst alongside non-India categories.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TUDIP_TECHNOLOGIES_CATALOG
