import { createDarwinboxScraper } from '../darwinbox/script.js'

const ROCKMAN_INDUSTRIES_OPTIONS = {
  companyName: 'Rockman Industries',
  source: 'rockmanindustries',
  origin: 'https://rockman.darwinbox.in',
}

const scraper = createDarwinboxScraper(ROCKMAN_INDUSTRIES_OPTIONS)

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createRockmanIndustriesScraper = () =>
  createDarwinboxScraper(ROCKMAN_INDUSTRIES_OPTIONS)
