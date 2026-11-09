import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FLATWORLD_MORTGAGE_PROCESSING_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasVerifiedApplicationFormSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Please fill in the form below')
    && normalized.includes('Select profile applying for')
    && normalized.includes('Mortgage Processor')
    && normalized.includes('Mortgage Underwriters')
    && normalized.includes('Flatworld Mortgage Pvt. Ltd.')
}

export const hasPublicJobListingsSignal = (html = '') =>
  /\b(current openings|job openings|view openings|open positions)\b/i.test(String(html ?? ''))
    && !/Please fill in the form below/i.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFlatworldMortgageProcessingScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedApplicationFormSignal(careersHtml)) {
      throw new Error('Flatworld Mortgage Processing verified careers form no longer matches the known public surface')
    }

    if (hasPublicJobListingsSignal(careersHtml)) {
      throw new Error('Flatworld Mortgage Processing now exposes a public job listings surface')
    }

    return []
  },
})

export const run = async (options = {}) => createFlatworldMortgageProcessingScraper().run(options)

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
