import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.straive.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_BRAND_PATTERN = /\bStraive\b/i
const CAREERS_PATTERN = /\bCareers?\b/i
const APPLY_CTA_PATTERN = /Apply\s+For\s+Job/i
const EMAIL_PATTERNS = [
  /mailto:INCareers@straive\.com/i,
  /mailto:GlobalCareers@straive\.com/i,
]
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|icims\.com|\/jobs?\/\d+|current openings|job openings/i

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return OFFICIAL_BRAND_PATTERN.test(page)
    && CAREERS_PATTERN.test(page)
    && APPLY_CTA_PATTERN.test(page)
    && EMAIL_PATTERNS.every((pattern) => pattern.test(page))
}

export const hasPublicJobBoardSignal = (html = '') =>
  PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const extractSearchResults = () => []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'straive',
  timeoutMs: 15000,
})

export const createStraiveScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Straive careers page no longer matches the verified official public surface')
    }

    if (hasPublicJobBoardSignal(html)) {
      throw new Error('Straive careers page now appears to expose public job listings')
    }

    return extractSearchResults(html)
  },
})

export const run = async (options = {}) => createStraiveScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'straive')
  }
}
