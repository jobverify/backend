import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'Saal AI'
export const SOURCE = 'saalai'
export const DARWINBOX_COMPANY_ID = 'a6824906a5ab4c'
export const DARWINBOX_ORIGIN = 'https://hrmsadcg.darwinbox.com'
export const OFFICIAL_CAREERS_URL = 'https://saal.ai/careers/'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const hasOfficialSaalAiCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return text.includes('Build Your Careers at SAAL')
    && text.includes('SAAL offers a dynamic environment where talent, technology, and ambition come together to accelerate your career')
    && text.includes('If you’re ready to make an impact and grow with a fast-moving team, SAAL is the place for you')
    && text.includes('Search and View Jobs')
    && /https:\/\/hrmsadcg\.darwinbox\.com\/ms\/candidatev2\/a6824906a5ab4c\/careers\/home/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'saalai-official',
  timeoutMs: 15000,
})

export const createSaalAiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialSaalAiCareersSignals(careersHtml)) {
      throw new Error('Saal AI verified official careers page no longer matches the verified public surface')
    }

    return darwinboxScraper.run({
      maxPages,
      maxJobs,
      fetchListingPage,
    })
  },
})

export const run = async (options = {}) => createSaalAiScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Saal AI scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log('Dry run - wrote jobs to jobs.json')
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
