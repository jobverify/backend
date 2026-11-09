import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FACTSPAN_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.companyCareerPage
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const hasCurrentOpeningsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Current Openings')
    && normalized.includes('Reach us at')
    && normalized.includes('contact@factspan.com')
}

export const hasPublicJobListingsSignal = (html = '') =>
  /apply now|view job description|job id|job opening|job title|requisition|careers\/job\//i
    .test(normalizeWhitespace(html))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFactspanScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)

    if (!hasCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('Factspan current-openings page no longer matches the verified first-party shell')
    }

    if (hasPublicJobListingsSignal(currentOpeningsHtml)) {
      throw new Error('Factspan current-openings page now exposes a trustworthy public inventory')
    }

    return []
  },
})

export const run = async (options = {}) => createFactspanScraper().run(options)

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
