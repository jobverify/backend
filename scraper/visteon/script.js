import { createDarwinboxScraper } from '../darwinbox/script.js'

const createConfiguredScraper = () => createDarwinboxScraper({
  companyName: 'Visteon Corporation',
  source: 'visteon',
  companyId: 'main',
  origin: 'https://visteon-panorama.darwinbox.com',
  pageSize: 10,
})

const scraper = createConfiguredScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createVisteonScraper = createConfiguredScraper
