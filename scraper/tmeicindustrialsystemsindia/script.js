import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tmeicindustrialsystemsindia'
export const COMPANY = 'TMEIC Industrial Systems India Private Limited'
export const CAREERS_URL = 'https://tmeic.com/careers/'
export const INDIA_ZERO_JOBS_MESSAGE = 'Please check back for career opportunities.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const INTRO_TEXT = 'Select a region below to join our world-class team.'
const REGION_SEQUENCE = [
  'Japan',
  'North America',
  'Europe',
  'India',
  'Southeast Asia',
  'China',
]

const getCareersSectionText = (html) => {
  const normalized = normalizeWhitespace(html)
  const introIndex = normalized.toLowerCase().indexOf(INTRO_TEXT.toLowerCase())

  if (introIndex === -1) return null
  return normalized.slice(introIndex)
}

export const hasOfficialCareersSignal = (html) => {
  const sectionText = getCareersSectionText(html)
  if (!sectionText) return false

  return REGION_SEQUENCE.every((region) => sectionText.includes(region))
}

export const extractIndiaSectionText = (html) => {
  const sectionText = getCareersSectionText(html)
  if (!sectionText) return null

  const match = sectionText.match(/\bIndia\b\s+(.+?)\s+\bSoutheast Asia\b/i)
  return match ? match[1].trim() : null
}

export const hasIndiaZeroJobsSignal = (html) =>
  extractIndiaSectionText(html) === INDIA_ZERO_JOBS_MESSAGE

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTmeicIndustrialSystemsIndiaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('TMEIC careers page no longer matches the verified official public surface')
    }

    if (!hasIndiaZeroJobsSignal(careersHtml)) {
      throw new Error('TMEIC India careers section no longer matches the verified zero-job state')
    }

    return []
  },
})

export const run = async (options = {}) => createTmeicIndustrialSystemsIndiaScraper().run(options)

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
