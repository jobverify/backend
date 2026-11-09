import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KLOOK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KLOOK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_SEARCH_URL = PROVIDER_METADATA.jobsSearchUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasMokaLoginSignal = (page = {}) => {
  const url = String(page.url || '')
  const html = String(page.html || '').toLowerCase()

  return Number(page.status) === 200
    && /https?:\/\/www\.klookcareers\.com\/login\b/i.test(url)
    && (html.includes('moka: login') || html.includes('please do not disable javascript'))
}

export const createKlookScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const page = await fetchPage(JOBS_SEARCH_URL)
    if (!hasMokaLoginSignal(page)) {
      throw new Error('Klook official jobs surface changed from the verified Moka login-gated state')
    }

    return []
  },
})

export const run = async (options = {}) => createKlookScraper().run(options)

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
