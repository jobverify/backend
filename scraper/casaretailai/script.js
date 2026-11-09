import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://casaretail.ai/'
export const COMPANY_URL = 'https://casaretail.ai/company'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const BRAND_PATTERN = /\bCasa Retail AI\b/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|\/careers\b|\/jobs\b|join-us|job openings|current openings/i

export const hasOfficialCasaRetailAiSignal = (html) => BRAND_PATTERN.test(String(html ?? ''))

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'casaretailai',
  timeoutMs: 15000,
})

export const createCasaRetailAiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    const companyHtml = await fetchText(COMPANY_URL)

    if (!hasOfficialCasaRetailAiSignal(homepageHtml) || !hasOfficialCasaRetailAiSignal(companyHtml)) {
      throw new Error('Casa Retail AI public brand surfaces changed; refusing to assume no public listings')
    }

    if (hasPublicJobBoardSignal(homepageHtml) || hasPublicJobBoardSignal(companyHtml)) {
      throw new Error('Casa Retail AI public surface now appears to expose job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createCasaRetailAiScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'casaretailai')
  }
}
