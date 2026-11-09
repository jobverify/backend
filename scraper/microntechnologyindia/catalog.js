import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MICRON_TECHNOLOGY_INDIA_CATALOG = {
  source: 'microntechnologyindia',
  companyName: 'Micron Technology India',
  officialBrandName: 'Micron Technology',
  adapter: 'script',
  homepageUrl: 'https://in.micron.com/',
  companyCareerPage: 'https://in.micron.com/about/careers',
  publicBoardUrl: 'https://micron.eightfold.ai/careers?location=India&domain=micron.com',
  listingApiUrl: 'https://careers.micron.com/api/pcsx/search',
  detailApiUrlTemplate:
    'https://careers.micron.com/api/pcsx/position_details?position_id={{jobId}}&domain=micron.com&hl=en',
  apiQuery: {
    domain: 'micron.com',
    query: '',
    location: 'India',
  },
  companyDomain: 'micron.com',
  atsPlatform: 'eightfold',
  countryFilter: 'India',
  paginationStrategy: 'verified-india-careers-page-plus-public-eightfold-search-pagination',
  extractionStrategy: 'verified-india-careers-page+eightfold-search-api+public-position-urls+india-openings-only',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunEnrichPublicExperience: false,
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://in.micron.com/about/careers is the live first-party Micron India careers page, that it exposes a "Search jobs" handoff to https://careers.micron.com/careers plus a "Search current jobs" India CTA to https://micron.eightfold.ai/careers?location=India&domain=micron.com, and that the public Eightfold search API at https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=0&limit=10 returned 288 live India openings including "STAFF ENG-HIG-HBM-LAYOUT" in Hyderabad, Telangana, India. Verified that the listing payload itself exposes public position URLs under https://careers.micron.com/careers/job/ and currently returns 10 positions per page even when higher limit values are requested.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MICRON_TECHNOLOGY_INDIA_CATALOG
