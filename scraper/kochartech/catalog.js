import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_JOB_DETAIL_URLS = [
  'https://www.kochartech.com/career/senior-manager-sales-2/',
  'https://www.kochartech.com/career/inside-sales-executive-sales/',
  'https://www.kochartech.com/career/assistant-manager-operations/',
]

const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.kochartech.com/careers/ is the official KocharTech careers page and that the same first-party WordPress REST feed at https://www.kochartech.com/wp-json/wp/v2/career?per_page=100 exposes current public roles including Senior Manager-Sales and Inside Sales Executive. Verified same-domain detail pages under /career/ with the live Maxicus apply handoff.'

export const KOCHARTECH_CATALOG = {
  source: 'kochartech',
  companyName: 'KocharTech',
  officialBrandName: 'KocharTech',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.kochartech.com/',
  companyCareerPage: 'https://www.kochartech.com/careers/',
  careerApiUrl: 'https://www.kochartech.com/wp-json/wp/v2/career?per_page=100',
  verifiedJobDetailUrls: VERIFIED_JOB_DETAIL_URLS,
  companyDomain: 'kochartech.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-wordpress-rest-career-feed',
  extractionStrategy: 'verified-careers-page+wordpress-rest-career-feed+same-domain-detail-pages+maxicus-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default KOCHARTECH_CATALOG
