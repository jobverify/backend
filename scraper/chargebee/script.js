import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.chargebee.com/careers/join-us/'
export const LINKEDIN_JOBS_URL = 'https://in.linkedin.com/company/chargebee/jobs/'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const buildSearchUrl = () => CAREER_PAGE_URL

export const pageIndicatesLinkedinOnly = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    normalized.includes('explore our linkedin jobs')
    || (
      normalized.includes('explore opportunities')
      && normalized.includes('linkedin.com/company/chargebee/jobs')
    )
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

export const createChargebeeScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())

    if (!pageIndicatesLinkedinOnly(html)) {
      throw new Error('Chargebee careers page no longer exposes the expected LinkedIn-only signal')
    }

    return []
  },
})

export const run = async () => createChargebeeScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Chargebee scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'chargebee')
    console.log('DB result:', result)
    process.exit(0)
  }
}
