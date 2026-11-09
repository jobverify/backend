import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'silvermine'
export const COMPANY = 'Silvermine Group LLC'
export const CAREERS_URL = 'https://www.silverminegroup.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&rsquo;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const OFFICIAL_CAREERS_SIGNALS = [
  'careers - silvermine group llc',
  'careers',
  'what we offer',
  'competitive salary',
  'hybrid work model',
  'competitive health benefits',
  'rewards and recognitions',
  'diverse workforce',
  'top it infrastructure',
  'open positions',
  "check out our open positions below - and click the link to apply",
  'silvermine group llc',
]

const PUBLIC_JOB_BOARD_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /workdayjobs/i,
  /\/jobs\/[a-z0-9-]+/i,
  /\/careers\/[a-z0-9-]+/i,
  /\bapply now\b/i,
  /\bview job\b/i,
  /\bjob openings\b/i,
  /\bcurrent openings\b/i,
]

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return OFFICIAL_CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOB_BOARD_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSilvermineScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Silvermine official careers page changed; refusing to assume zero public listings')
    }

    if (hasPublicJobBoardSignal(careersHtml)) {
      throw new Error('Silvermine careers page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createSilvermineScraper().run(options)

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
