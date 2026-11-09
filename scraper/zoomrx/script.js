import { createDarwinboxScraper } from '../darwinbox/script.js'

const createConfiguredScraper = () => createDarwinboxScraper({
  companyName: 'ZoomRx',
  source: 'zoomrx',
  companyId: '5f62e79639198',
  pageSize: 10,
  origin: 'https://zoomrx.darwinbox.in',
})

const scraper = createConfiguredScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createZoomRxScraper = createConfiguredScraper
