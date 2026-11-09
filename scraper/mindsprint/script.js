import { createDarwinboxScraper } from '../darwinbox/script.js'

const createConfiguredScraper = () => createDarwinboxScraper({
  companyName: 'Mindsprint',
  source: 'mindsprint',
  companyId: 'a671608963ef6d',
  origin: 'https://mindsprint.darwinbox.in',
})

const scraper = createConfiguredScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createMindsprintScraper = createConfiguredScraper
