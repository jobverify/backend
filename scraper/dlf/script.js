import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.dlf.in/career-page'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasCareerPageSignal = (html) => /career at dlf groups|<h1[^>]*>\s*careers\s*<\/h1>|come,\s*grow with us/i
  .test(String(html ?? ''))

export const hasNoPublicListingsSignal = (html) => /notice on fraudulent job offer[\s\S]*?hrd@dlf\.in[\s\S]*?interested in joining us[\s\S]*?send us your cv on hrd@dlf\.in/i
  .test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'dlf',
  timeoutMs: 15000,
})

export const createDlfScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasCareerPageSignal(html)) {
      throw new Error('DLF careers page no longer matches the official DLF careers surface')
    }

    if (!hasNoPublicListingsSignal(html)) {
      throw new Error('DLF careers page now appears to expose a different hiring flow')
    }

    return []
  },
})

export const run = async () => createDlfScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'dlf')
  }
}
