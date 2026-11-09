import path from 'path'
import { fileURLToPath } from 'url'

export const CAREER_PAGE_URL = 'https://deltax.jobsoid.com/'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const buildSearchUrl = () => CAREER_PAGE_URL

export const validateNoOpeningsPage = (html) => {
  const page = String(html ?? '')

  return /<h2[^>]*>\s*Current Openings\s*<\/h2>/i.test(page)
    && /<h3[^>]*>\s*No Current Openings\s*<\/h3>/i.test(page)
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

export const createDeltaXScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())

    if (!validateNoOpeningsPage(html)) {
      throw new Error('DeltaX careers page no longer exposes the expected no-openings page shape')
    }

    return []
  },
})

export const run = async () => createDeltaXScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running DeltaX scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'deltax')
    console.log('DB result:', result)
    process.exit(0)
  }
}
