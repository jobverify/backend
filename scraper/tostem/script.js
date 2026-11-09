import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tostem'
export const HOMEPAGE_URL = 'https://www.tostemindia.com/'
export const CAREERS_URL = 'https://www.tostemindia.com/career/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bview openings\b/i,
  /\bjob search\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our talent community\b/i,
  /linkedin\.com\/jobs/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitcrm/i,
  /hiring\.workable\.com/i,
  /\/job\/[a-z0-9-]+/i,
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchPage = async (url, {
  fetchImpl = null,
  timeoutMs = 20000,
} = {}) => {
  if (fetchImpl) {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createTimeoutSignal(timeoutMs),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  }

  return fetchPageWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs,
  })
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*leading aluminium windows and doors manufacturer, supplier company \| tostem india\s*<\/title>/i.test(page)
    && normalized.includes('japanese innovation in window design')
    && normalized.includes('lixil window system')
    && /href=["']https:\/\/www\.tostemindia\.com\/career\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Tostem India Jobs Vacancy Recruitment, Career Portal for Fresher/i.test(page)
    && normalized.includes('japanese innovation in window design')
    && normalized.includes('lixil window system')
    && normalized.includes('support.lwsindia@lixil.com')
    && normalized.includes('tostem india. all rights reserved.')
    && normalized.includes('career portal for fresher & experienced job opening')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createTostemScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('TOSTEM verified official homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('TOSTEM verified career stub no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('TOSTEM career page now appears to expose a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createTostemScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
