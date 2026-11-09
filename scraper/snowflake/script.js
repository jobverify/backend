import path from 'path'
import { fileURLToPath } from 'url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Snowflake',
  source: 'snowflake',
  baseUrl: 'https://careers.snowflake.com',
  searchPath: '/us/en/search-results',
  scraperDir: currentDir,
  nativeUnspecifiedState: true,
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
} = scraper


// The native date-sorted 100-row offsets overlap at a page boundary. Keep the
// request bounded, but fit the currently 380-role global inventory in one page.
// The engine still reconciles every unique role, total, target facet and cap.
export const run = (options = {}) => {
  const getJson = options.fetchJson || ((url, init) => fetchJsonWithRetry(url, {
    ...init, attempts: 1, timeoutMs: 15000, label: 'snowflake Phenom listings',
  }))
  return scraper.run({
    ...options,
    useWidgetApi: options.useWidgetApi ?? Boolean(options.fetchJson || !options.fetchText),
    fetchJson: (url, init = {}) => {
      if (String(url) === 'https://careers.snowflake.com/widgets' && init.method === 'POST') {
        const body = JSON.parse(init.body)
        if (body.ddoKey === 'refineSearch' && body.pageName === 'search-results'
          && body.jobs === true && body.counts === true && body.global === true
          && Number.isInteger(body.from) && body.from >= 0
          && Number.isInteger(body.size) && body.size > 0 && body.size <= 500) {
          return getJson(url, { ...init, body: JSON.stringify({ ...body, size: 500 }) })
        }
      }
      return getJson(url, init)
    },
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Snowflake scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'snowflake')
    console.log('DB result:', result)
    process.exit(0)
  }
}
