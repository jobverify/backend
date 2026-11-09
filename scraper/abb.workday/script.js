import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'abb'
export const COMPANY = 'ABB'
export const BASE_URL = 'https://careers.abb'
export const SEARCH_PATH = '/global/en/search-results'

const phenomScraper = createPhenomScraper({
  companyName: COMPANY,
  source: SOURCE,
  baseUrl: BASE_URL,
  searchPath: SEARCH_PATH,
  scraperDir: currentDir,
  nativeLocalizedCountryNames: [{ locale: 'fi', region: 'IN' }],
  defaultDetailEnrichmentBudgetMs: 120000,
  defaultDetailConcurrency: 4,
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
} = phenomScraper

export const createAbbScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const jobs = await phenomScraper.run(options)
    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAbbScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
