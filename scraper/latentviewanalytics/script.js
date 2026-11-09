import { createDarwinboxScraper } from '../darwinbox/script.js'

export const COMPANY_NAME = 'LatentView Analytics'
export const SOURCE = 'latentviewanalytics'
export const COMPANY_ID = 'main'
export const DARWINBOX_ORIGIN = 'https://latentview.darwinbox.in'
export const OFFICIAL_CAREERS_URL = 'https://www.latentview.com/career/'
export const OFFICIAL_CAREERS_HANDOFF_URL = `${DARWINBOX_ORIGIN}/ms/candidate/careers`
export const PUBLIC_PORTAL_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${COMPANY_ID}/careers/allJobs`

const LATENTVIEW_ANALYTICS_OPTIONS = {
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
}

const scraper = createDarwinboxScraper(LATENTVIEW_ANALYTICS_OPTIONS)

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createLatentViewAnalyticsScraper = () =>
  createDarwinboxScraper(LATENTVIEW_ANALYTICS_OPTIONS)
