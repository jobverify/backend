import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PUBMATIC_CATALOG = {
  source: 'pubmatic',
  companyName: 'PubMatic',
  officialBrandName: 'PubMatic',
  adapter: 'script',
  homepageUrl: 'https://pubmatic.com/',
  companyCareerPage: 'https://pubmatic.com/careers/job-search/',
  companyDomain: 'pubmatic.com',
  atsPlatform: 'first-party-html-jobs-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-location-grouped-openings-page',
  extractionStrategy: 'first-party-html-location-sections+job-link-extraction+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://pubmatic.com/careers/job-search/ was PubMatic\'s live first-party jobs page, that the public HTML exposed "62 open positions", and that grouped location sections including "Gurugram, IN" and India-linked roles such as "Senior Performance Advertising Engineer" were publicly enumerable from the first-party surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PUBMATIC_CATALOG
