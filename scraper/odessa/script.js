import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ODESSA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ODESSA_CATALOG.source
export const COMPANY = ODESSA_CATALOG.companyName
export const HOMEPAGE_URL = ODESSA_CATALOG.homepageUrl
export const CAREERS_URL = ODESSA_CATALOG.companyCareerPage
export const JOBS_API_URL = ODESSA_CATALOG.jobsApiUrl
export const VERIFIED_ON = ODESSA_CATALOG.verifiedOn
export const PROVIDER_METADATA = ODESSA_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const hasVerifiedOdessaCareersSignal = (html) =>
  /<title>\s*Careers\s*\|\s*All Job Openings\s*\|\s*Odessa\s*<\/title>/i.test(String(html))
  && /darwinbox-careers-js/i.test(String(html))
  && /career_ajax/i.test(String(html))

export const isCredentialBlockedJobsPayload = (payload) =>
  String(payload?.error ?? '').includes('HTTP 401')
  && /invalid credentials/i.test(String(payload?.raw ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createOdessaScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedOdessaCareersSignal(careersHtml)) {
      throw new Error('Odessa verified official careers surface changed')
    }

    const jobsPayload = await fetchJson(JOBS_API_URL)
    if (!isCredentialBlockedJobsPayload(jobsPayload)) {
      throw new Error('Odessa first-party jobs endpoint no longer matches the verified blocked state')
    }

    return []
  },
})

export const run = async (options = {}) => createOdessaScraper().run(options)

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
