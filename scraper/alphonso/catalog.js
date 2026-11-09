import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALPHONSO_CATALOG = {
  source: 'alphonso',
  companyName: 'Alphonso',
  officialBrandName: 'LG Ad Solutions',
  legalEntityName: 'Alphonso Inc.',
  adapter: 'script',
  companyCareerPage: 'https://alphonso.tv/careers',
  companyDomain: 'alphonso.tv',
  officialHomepageUrl: 'https://alphonso.tv/',
  parentCareersPage: 'https://lgads.tv/careers/',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/lgads',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/lgads',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-redirect-plus-public-ashby-job-board',
  extractionStrategy:
    'verified-homepage+verified-parent-careers-redirect+verified-ashby-embed+ashby-job-board-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://alphonso.tv/ is the live first-party Alphonso site, that https://alphonso.tv/careers redirects to the official parent careers page at https://lgads.tv/careers/, that page embeds the public LG Ad Solutions Ashby board via https://jobs.ashbyhq.com/lgads/embed and https://api.ashbyhq.com/posting-api/job-board/lgads, and the verified board currently includes India roles in Bangalore.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ALPHONSO_CATALOG
