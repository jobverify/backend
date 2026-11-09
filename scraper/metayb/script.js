import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import METAYB_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = METAYB_CATALOG
export const SOURCE = METAYB_CATALOG.source
export const COMPANY = METAYB_CATALOG.companyName
export const CAREERS_URL = METAYB_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|button|a)>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /https?:\/\/jobs\.ashbyhq\.com\//i,
  /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\//i,
  /https?:\/\/jobs\.lever\.co\//i,
  /https?:\/\/[^\s"'<>]*myworkdayjobs\.com\//i,
  /https?:\/\/[^\s"'<>]*workdayjobs\.com\//i,
  /https?:\/\/[^\s"'<>]*smartrecruiters\.com\//i,
  /https?:\/\/[^\s"'<>]*jobvite\.com\//i,
  /https?:\/\/[^\s"'<>]*workable\.com\//i,
  /\/job-openings\//i,
  /\bapply now\b/i,
  /\bcurrent openings\b/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

  return (
    normalized.includes('Advance your career as we evolve')
    && normalized.includes('Explore Open Positions')
  ) || title === 'Metayb | AI-Native Digital Consultancy for Enterprise Transformation'
}

export const hasPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

export const createMetaybScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('Metayb public jobs surface changed materially; replace the fail-closed sentinel with a real scraper')
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Metayb careers section no longer matches the trusted first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createMetaybScraper().run(options)

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
