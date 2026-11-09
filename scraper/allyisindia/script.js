import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ALLYIS_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ALLYIS_INDIA_CATALOG.source
export const CAREERS_URL = ALLYIS_INDIA_CATALOG.companyCareerPage
export const EMBEDDED_JOBS_URL = ALLYIS_INDIA_CATALOG.embeddedJobsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Join Our Team')
    && normalized.includes('Jobs at Allyis, India')
    && normalized.includes('TechM Allyis')
    && /staffing\.allyisapps\.com\/home\/listjobs\/114025/i.test(page)
}

const defaultFetchPage = async (url) => ({
  status: 200,
  url,
  html: await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  }),
})

export const createAllyisIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('The verified Allyis India careers page no longer matches the pinned first-party surface')
    }

    const iframePage = await fetchPage(EMBEDDED_JOBS_URL)
    if (iframePage.status === 200) {
      throw new Error('Allyis India embedded jobs host is reachable again and requires a real scraper upgrade')
    }
    throw new Error('Allyis India embedded jobs host changed materially and requires manual review')
  },
})

export const run = async (options = {}) => createAllyisIndiaScraper().run(options)

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
