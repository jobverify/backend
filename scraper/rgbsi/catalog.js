import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BOARD_URL = 'https://careers.smartrecruiters.com/RGBSI'
export const LISTING_API_URL = 'https://api.smartrecruiters.com/v1/companies/RGBSI/postings'
export const DETAIL_API_URL_TEMPLATE =
  'https://api.smartrecruiters.com/v1/companies/RGBSI/postings/{{jobId}}'

export const RGBSI_CATALOG = {
  source: 'rgbsi',
  companyName: 'RGBSI',
  officialBrandName: 'RGBSI',
  adapter: 'script',
  homepageUrl: 'https://www.rgbsi.com/',
  companyCareerPage: BOARD_URL,
  boardUrl: BOARD_URL,
  companyDomain: 'rgbsi.com',
  atsPlatform: 'smartrecruiters',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-smartrecruiters-board-plus-api',
  extractionStrategy:
    'verified-exact-name-smartrecruiters-board+official-homepage-link+smartrecruiters-jobs-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.smartrecruiters.com/RGBSI remained the exact-name RGBSI SmartRecruiters board linked back to the official RGBSI homepage and visibly listed roles including CNC programmer and Supplier Quality Engineer. The verified board exposed no India-visible openings on that date, so this local provider validates the branded board and queries the SmartRecruiters jobs API with an India filter, returning an empty set until India jobs appear.',
  config: {
    request: {
      method: 'GET',
      query: {
        limit: '100',
        country: 'in',
      },
    },
    discovery: {
      listingApiUrl: LISTING_API_URL,
    },
    detail: {
      urlTemplate: DETAIL_API_URL_TEMPLATE,
    },
  },
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'rgbsi/jobs.json',
}

export default RGBSI_CATALOG
