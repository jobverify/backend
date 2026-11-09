import path from 'path'
import { fileURLToPath } from 'url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Danaher Corporation',
  source: 'danahercorporation',
  baseUrl: 'https://jobs.danaher.com',
  searchPath: '/global/en/search-results?keywords=India',
  listingPredicate: (job) => (
    job?.opco === 'Danaher Corporation'
      && job?.country === 'India'
  ),
  scraperDir: currentDir,
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
  run,
} = scraper
