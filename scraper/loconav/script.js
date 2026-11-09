import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { LOCONAV_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LOCONAV_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Build Your Career with LocoNav')
    && normalized.includes('See Job Openings')
    && normalized.includes('LocoNav is the world')
  }

export const hasFirstPartyJobInventory = (html = '') => {
  const rawHtml = String(html)
  const normalized = normalizeWhitespace(html)
  const firstPartyJobLink = [...rawHtml.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .some((href) => {
      if (/linkedin\.com/i.test(href)) return false
      return /\/jobs?\/|\/careers?\//i.test(href)
    })

  return firstPartyJobLink
    || /current openings|open positions|job role/i.test(normalized)
  }

export const createLoconavScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('LocoNav careers page no longer matches the verified first-party surface')
    }

    if (hasFirstPartyJobInventory(careersHtml)) {
      throw new Error('LocoNav now appears to expose first-party public job inventory and needs a verified scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createLoconavScraper(options).run(options)

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
