import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ENOAH_ISOLUTION_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_PAGE_URL = PROVIDER_METADATA.jobsBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Job Opportunity/i.test(text)
    && /Watch this space/i.test(text)
    && extractJobsPageUrl(page) === JOBS_PAGE_URL
}

export const extractJobsPageUrl = (html = '') =>
  String(html ?? '').match(/href=["'](https:\/\/enoahisolution\.com\/careers\/jobs\/)["']/i)?.[1] ?? null

export const hasZeroOpeningsSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return /Current Job Opportunities/i.test(text) && /We currently have no job openings/i.test(text)
}

export const hasTrustworthyPublicJobsSignal = (html = '') => {
  const text = normalizeWhitespace(html).toLowerCase()

  return /\bapply now\b/.test(text)
    || /\bread more\b/.test(text)
    || (/\bexperience\b/.test(text) && /\bcurrent job opportunities\b/.test(text) && !/\bno job openings\b/.test(text))
}

export const createENoahISolutionScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('eNoah iSolution verified careers page no longer matches the trusted first-party surface')
    }

    const jobsPageUrl = extractJobsPageUrl(careersHtml)
    if (jobsPageUrl !== JOBS_PAGE_URL) {
      throw new Error('eNoah iSolution verified careers page no longer resolves to the trusted jobs page')
    }

    const jobsHtml = await fetchText(jobsPageUrl)
    if (hasTrustworthyPublicJobsSignal(jobsHtml)) {
      throw new Error('eNoah iSolution exact-name surface now exposes a trustworthy public jobs surface')
    }

    if (hasZeroOpeningsSignal(jobsHtml)) {
      return []
    }

    throw new Error('eNoah iSolution verified zero-openings shell changed materially')
  },
})

export const run = async (options = {}) => createENoahISolutionScraper().run(options)

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
