import { createDarwinboxScraper } from '../darwinbox/script.js'

const TESSOLVE_OPTIONS = {
  companyName: 'Tessolve',
  source: 'tessolve',
  origin: 'https://tessolve.darwinbox.com',
}

const scraper = createDarwinboxScraper(TESSOLVE_OPTIONS)

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createTessolveScraper = () => createDarwinboxScraper(TESSOLVE_OPTIONS)
