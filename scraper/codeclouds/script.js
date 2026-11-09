import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { CODECLOUDS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = CODECLOUDS_CATALOG.source
export const COMPANY = CODECLOUDS_CATALOG.companyName
export const CAREERS_URL = CODECLOUDS_CATALOG.companyCareerPage
export const VERIFIED_ON = CODECLOUDS_CATALOG.verifiedOn
export const PROVIDER_METADATA = CODECLOUDS_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeText = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

export const hasVerifiedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return text.includes('search jobs at codeclouds')
    && (
      text.includes('discover your dream job at codeclouds')
      || text.includes('apply now')
    )
}

export const hasVerifiedZeroJobsSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('showing 0 jobs')
    && text.includes('no jobs found with current filters')
  }

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCodeCloudsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('The verified CodeClouds jobs page no longer matches the trusted first-party surface')
    }

    if (!hasVerifiedZeroJobsSignal(careersHtml)) {
      throw new Error('The verified CodeClouds zero-results state changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createCodeCloudsScraper().run(options)

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
