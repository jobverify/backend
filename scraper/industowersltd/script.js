import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'industowersltd'
export const COMPANY = 'Indus Towers Ltd'
export const CAREERS_URL = 'https://www.industowers.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const OFFICIAL_CAREERS_SIGNALS = [
  'careers with us | gallup exceptional workplace award 2021 | indus towers',
  'indusians: our greatest asset',
  'employer of choice',
  'great exceptional workplace',
  'the winner of gallup exceptional workplace award for the 12th consecutive year in 2025',
  'life at indus',
  'learning & development at indus',
  'growing with indus',
  'cloud-based hr solution',
]

const PUBLIC_JOB_LISTINGS_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
  /\/careers?\/jobs?\/[a-z0-9-]+/i,
  /\/jobs?\/[a-z0-9-]+/i,
  /\bapply now\b/i,
  /\bview job\b/i,
  /\bjob openings\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob description\b/i,
]

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return OFFICIAL_CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobListingsSignal = (html) =>
  PUBLIC_JOB_LISTINGS_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIndusTowersLtdScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Indus Towers Ltd official careers page changed; refusing to assume zero public listings')
    }

    if (hasPublicJobListingsSignal(careersHtml)) {
      throw new Error('Indus Towers Ltd careers page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createIndusTowersLtdScraper().run(options)

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
