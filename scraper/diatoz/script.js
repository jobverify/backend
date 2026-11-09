import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.diatoz.com/careers'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN = /careers\s*\|\s*diatoz|ready to build with us|we'd love to hear from you/i
const APPLY_SIGNAL_PATTERN = /apply now/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'diatoz',
  timeoutMs: 15000,
})

export const hasCareerPageSignal = (html) => {
  const value = String(html ?? '')
  return CAREERS_SIGNAL_PATTERN.test(value) && APPLY_SIGNAL_PATTERN.test(value)
}

export const createDiatozScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasCareerPageSignal(html)) {
      throw new Error('DIATOZ careers page no longer exposes the expected public application signals')
    }

    return []
  },
})

export const run = async () => createDiatozScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running DIATOZ scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'diatoz')
    console.log('DB result:', result)
    process.exit(0)
  }
}
