import { createDarwinboxScraper } from '../darwinbox/script.js'

const createConfiguredScraper = () => createDarwinboxScraper({
  companyName: 'MG Motor India',
  source: 'mgmotorindia',
  companyId: 'main',
  origin: 'https://mgmhr.darwinbox.in',
})

const scraper = createConfiguredScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createMgMotorIndiaScraper = createConfiguredScraper
