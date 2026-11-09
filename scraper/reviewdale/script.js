import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'reviewdale'
export const COMPANY_NAME = 'ReviewDale'
export const OFFICIAL_ROOT_URL = 'https://www.reviewdale.com/'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedOfficialSurface = (html = '') => {
  const page = String(html ?? '')
  return /ReviewDale/i.test(page)
    && /JavaScript/i.test(page)
    && !/\b(careers?|jobs?|open positions|vacancies|apply now)\b/i.test(page)
}

export const createReviewDaleScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const officialSurfaceHtml = await fetchText(OFFICIAL_ROOT_URL)

    if (!hasVerifiedOfficialSurface(officialSurfaceHtml)) {
      throw new Error(
        `ReviewDale verified first-party surface changed materially: ${OFFICIAL_ROOT_URL}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createReviewDaleScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/reviewdale/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
