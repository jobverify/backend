import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.titancompany.in/careers'
export const SEARCH_RESULTS_URL = 'https://careers.titan.in/in/en/search-results'
export const SOURCE = 'titan'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(
    String(html ?? '').replace(/<[^>]+>/g, ' '),
  )?.toLowerCase() || ''

  return normalized.includes('career opportunities at titan company')
    && normalized.includes('current vacancies')
    && normalized.includes('life at titan')
    && normalized.includes('working at titan company limited')
}

export const extractCurrentVacanciesUrl = (html) => {
  const page = String(html ?? '')
  const match = page.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Current vacancies\s*<\/a>/i)

  if (!match) return null

  try {
    return new URL(match[1], CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const hasZeroJobsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /SEARCH RESULTS/i.test(page)
    && normalized?.includes('Sorry... no active job openings, please come back later.')
    && /We couldn[\u2019']t find any open positions for/i.test(normalized || '')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTitanScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Titan careers page no longer matches the verified official public surface')
    }

    const currentVacanciesUrl = extractCurrentVacanciesUrl(careersHtml)
    if (currentVacanciesUrl !== SEARCH_RESULTS_URL) {
      throw new Error('Titan careers page no longer links to the verified official vacancies surface')
    }

    const searchResultsHtml = await fetchText(SEARCH_RESULTS_URL)
    if (!hasZeroJobsSignal(searchResultsHtml)) {
      throw new Error('Titan public jobs surface now exposes openings or changed shape')
    }

    return []
  },
})

export const run = async (options = {}) => createTitanScraper().run(options)

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
