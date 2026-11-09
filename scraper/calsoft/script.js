import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CALSOFT_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
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

  return /Careers at Calsoft/i.test(page)
    && /Build Your Future in AI/i.test(page)
    && /Evolve with Calsoft/i.test(text)
    && /Open vacancies/i.test(text)
}

export const hasZeroResultsSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return /0 Results/i.test(text) && /No jobs found/i.test(text)
}

export const hasTrustworthyPublicJobsSignal = (html = '') => {
  const text = normalizeWhitespace(html).toLowerCase()

  return /\bapply now\b/.test(text)
    || /class=["'][^"']*job-card/i.test(String(html ?? ''))
    || /class=["'][^"']*job_listing/i.test(String(html ?? ''))
}

export const createCalsoftScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Calsoft verified careers page no longer matches the trusted first-party surface')
    }

    if (hasTrustworthyPublicJobsSignal(html)) {
      throw new Error('Calsoft exact-name surface now exposes a trustworthy public jobs surface')
    }

    if (hasZeroResultsSignal(html)) {
      return []
    }

    throw new Error('Calsoft verified zero-openings shell changed materially')
  },
})

export const run = async (options = {}) => createCalsoftScraper().run(options)

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
