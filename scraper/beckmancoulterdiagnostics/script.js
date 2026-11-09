import path from 'path'
import { fileURLToPath } from 'url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Beckman Coulter Diagnostics',
  source: 'beckmancoulterdiagnostics',
  baseUrl: 'https://jobs.danaher.com',
  searchPath: '/global/en/search-results?keywords=Beckman',
  listingPredicate: (job) => (
    job?.opco === 'Beckman Coulter Diagnostics'
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Beckman Coulter Diagnostics scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'beckmancoulterdiagnostics')
    console.log('DB result:', result)
    process.exit(0)
  }
}
