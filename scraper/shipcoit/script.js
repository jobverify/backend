import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SHIPCO_IT_CATALOG as PROVIDER_METADATA } from './catalog.js'

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

export const hasVerifiedCareersShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html)
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

  return (
    normalized.includes('Apply for a job')
    && normalized.includes('Title')
    && normalized.includes('Office')
    && normalized.includes('Job Type')
    && normalized.includes('Date Of Publishing')
    && normalized.includes('Description')
  ) || title === 'Shipco'
}

export const hasServerRenderedJobCards = (html = '') =>
  /<article\b|class=["'][^"']*job-card|class=["'][^"']*job-listing|href=["'][^"']*\/career\/[^"']+\/[^"']+["']/i
    .test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createShipcoItScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersShellSignal(careersHtml)) {
      throw new Error('Shipco It verified careers shell no longer matches the known first-party surface')
    }

    if (hasServerRenderedJobCards(careersHtml)) {
      throw new Error('Shipco It now exposes a server-rendered public jobs inventory')
    }

    return []
  },
})

export const run = async (options = {}) => createShipcoItScraper().run(options)

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
