import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://careers.7-eleven.com/search-jobs?l=India'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const buildSearchUrl = () => CAREER_PAGE_URL

export const pageIndicatesIndiaFalsePositive = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const hasExactIndiaLocation = /,\s*india(?:\s*<\/|\s*<|\s*$|\s*,)/i.test(String(html ?? ''))

  return (
    normalized.includes('job results found in india')
    && normalized.includes('indiana')
    && normalized.includes('/job/')
    && !hasExactIndiaLocation
  )
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createSevenElevenScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())

    if (!pageIndicatesIndiaFalsePositive(html)) {
      throw new Error('7-Eleven careers page no longer matches the expected India false-positive flow')
    }

    return []
  },
})

export const run = async () => createSevenElevenScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running 7-Eleven scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'seveneleven')
    console.log('DB result:', result)
    process.exit(0)
  }
}
