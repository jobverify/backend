import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { STARMARK_SOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
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

export const hasOfficialStarmarkCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Careers\s*\|\s*Starmark Software\b/i.test(page)
    && text.includes('Join Our Team')
    && text.includes('Join 1200+ professionals')
    && text.includes('careers@starmarksv.com')
  }

export const pageExposesStructuredJobListings = (html = '') => {
  const page = String(html ?? '')
  return /job[-_\s]?card/i.test(page)
    || /<a[^>]+href=["'][^"']+(job|career|opening)[^"']+["'][^>]*>\s*(Apply|View|Read|More Details)/i.test(page)
  }

export const createStarmarkSoftwareScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialStarmarkCareersSignal(careersHtml)) {
      throw new Error('Starmark Software official careers shell changed; refusing to assume no public listings')
    }

    if (pageExposesStructuredJobListings(careersHtml)) {
      throw new Error('Starmark Software careers shell now exposes structured public listings and needs a dedicated scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createStarmarkSoftwareScraper().run(options)

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
