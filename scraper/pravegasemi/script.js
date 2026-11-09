import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pravegasemi'
export const COMPANY = 'PravegaSemi Private Limited'
export const CAREERS_URL = 'https://pravegasemi.com/careers/'
export const CONTACT_URL = 'https://pravegasemi.com/contact/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_CAREERS_PATTERNS = [
  /Join\s+us\s+for\s+exiting\s+careers\s+in\s+cutting-edge\s+semiconductor\s+technology\s+and\s+engineering/i,
  /Reach\s+out\s+to\s+us\s+with\s+your\s+CV\/resume/i,
  /career@pravegasemi\.com/i,
  /Upload\s+your\s+CV/i,
  /Digital\s+Verification/i,
  /Physical\s+Design/i,
]

const OFFICIAL_IDENTITY_PATTERNS = [
  /PravegaSemi\s+Private\s+Limited/i,
  /sales@pravegasemi\.com/i,
  /career@pravegasemi\.com/i,
  /HSR\s+Layout/i,
]

const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|\/jobs\/[a-z0-9-]+|\bjob openings\b|\bcurrent openings\b|\bopen positions\b|\bapply now\b|\bjob id\b|\breq(?:uisition)? id\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_CAREERS_PATTERNS.every((pattern) => pattern.test(page))
}

export const hasOfficialIdentitySignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_IDENTITY_PATTERNS.every((pattern) => pattern.test(page))
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const createPravegaSemiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const contactHtml = await fetchText(CONTACT_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('PravegaSemi careers page no longer matches the verified public no-listings surface')
    }

    if (!hasOfficialIdentitySignal(contactHtml)) {
      throw new Error('PravegaSemi contact page no longer confirms the verified first-party company identity')
    }

    if (hasPublicJobBoardSignal(careersHtml)) {
      throw new Error('PravegaSemi careers page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createPravegaSemiScraper().run(options)

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
