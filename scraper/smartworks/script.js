import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.smartworksoffice.com/careers/'
export const JOBS_URL = 'https://www.smartworksoffice.com/careers/smartworks-latest-jobs-opening'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_BRAND_PATTERN = /\bSmartworks\b/i
const CAREERS_PATTERN = /\bCareers?\b/i
const MAILTO_PATTERN = /mailto:careers@sworks\.co\.in/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|\/job\/\d+|job openings|current openings/i

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasLegacySignals = OFFICIAL_BRAND_PATTERN.test(page)
    && CAREERS_PATTERN.test(page)
    && MAILTO_PATTERN.test(page)
  const hasCurrentLandingSignals = normalized.includes('Career at Smartworks')
    && normalized.includes('Join Our Team')
    && normalized.includes('Your journey to grow, innovate, and make an impact starts here.')
    && normalized.includes('View Open Positions')
    && normalized.includes('Life @Smartworks')

  return hasLegacySignals || hasCurrentLandingSignals
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const buildSearchUrl = () => CAREERS_URL

export const extractSearchResults = () => []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'smartworks',
  timeoutMs: 15000,
})

export const createSmartworksScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(buildSearchUrl())

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Smartworks careers page no longer matches the verified official public surface')
    }

    if (hasPublicJobBoardSignal(html)) {
      throw new Error('Smartworks careers page now appears to expose public job listings')
    }

    return extractSearchResults(normalizeWhitespace(html))
  },
})

export const run = async (options = {}) => createSmartworksScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'smartworks')
  }
}
