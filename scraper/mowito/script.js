import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.mowito.ai/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const BRAND_PATTERN = /\bMowito\b/i
const PRODUCT_PATTERN = /\bNeuralPick\b/i
const CAREERS_SECTION_PATTERN = /\bCareers\b/i
const CAREERS_EMAIL_PATTERN = /careers@mowito\.in/i
const INDIA_ADDRESS_PATTERN = /Chandra Layout Main Road|Vijayanagar,\s*Bengaluru|Bengaluru,\s*Karnataka\s*560040/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|myworkdayjobs|jobs-guest|linkedin\.com\/jobs\/view|base-search-card|job-search-card|open positions|current openings|job openings|view open positions|view all jobs|apply now/i

export const hasOfficialMowitoSignal = (html) => {
  const page = String(html ?? '')

  return BRAND_PATTERN.test(page)
    && PRODUCT_PATTERN.test(page)
    && CAREERS_SECTION_PATTERN.test(page)
    && CAREERS_EMAIL_PATTERN.test(page)
    && INDIA_ADDRESS_PATTERN.test(page)
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const extractSearchResults = () => []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'mowito',
  timeoutMs: 15000,
})

export const createMowitoScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialMowitoSignal(homepageHtml)) {
      throw new Error('Mowito official public surface changed; refusing to assume the verified careers-contact flow still applies')
    }

    if (hasPublicJobBoardSignal(homepageHtml)) {
      throw new Error('Mowito public site now appears to expose a public job board')
    }

    return extractSearchResults(homepageHtml)
  },
})

export const run = async (options = {}) => createMowitoScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'mowito')
  }
}
