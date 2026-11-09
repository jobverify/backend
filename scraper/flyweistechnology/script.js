import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FLYWEIS_TECHNOLOGY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = FLYWEIS_TECHNOLOGY_CATALOG.homepageUrl
export const SOURCE = FLYWEIS_TECHNOLOGY_CATALOG.source

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Flyweis Technology')
    && normalized.includes('We are an end-to-end IT services agency providing turnkey solutions for your business')
    && normalized.includes('Project Completed')
    && normalized.includes('Team Members')
}

export const hasCareersSignal = (html = '') =>
  /href=["'][^"']*\/(?:careers?|jobs?|join-us|work-with-us)[/"'#?]?/i.test(String(html ?? ''))
  || /\bcurrent openings\b|\bjob openings\b|\bopen positions\b/i.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFlyweisTechnologyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('The verified Flyweis Technology homepage no longer matches the pinned first-party marketing surface')
    }

    if (hasCareersSignal(homepageHtml)) {
      throw new Error('Flyweis Technology now appears to expose a public careers surface and requires a real scraper upgrade')
    }

    return []
  },
})

export const run = async (options = {}) => createFlyweisTechnologyScraper().run(options)

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
