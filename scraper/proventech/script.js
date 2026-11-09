import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PROVENTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = PROVENTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_ROUTE_URLS = [
  'https://hr.proventech.in/careers',
  'https://hr.proventech.in/jobs',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /myworkdayjobs/i,
  /darwinbox/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal, requestTimeoutMs = 15000 } = {}) => {
  const duration = Number(requestTimeoutMs)
  const deadline = AbortSignal.timeout(Number.isInteger(duration) && duration > 0 ? duration : 15000)
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
  requestSignal.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: requestSignal,
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedLoginShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*ProvenTech\s*<\/title>/i.test(page)
    && normalized.includes('Powered by ProvenTech')
    && normalized.includes('ProvenTech Human Resource Management System allows employees to access HR-related information.')
    && normalized.includes('Login')
    && normalized.includes('Forgot Password?')
}

export const isExpectedMissingCareerRoute = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 404
    && /<title>\s*Page not found at \/(careers|jobs)\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Page not found')
    && !hasPublicJobsSignal(rawHtml)
}

export const createProventechScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, requestTimeoutMs } = {}) {
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, { signal, requestTimeoutMs })
    signal?.throwIfAborted()
    if (Number(homepage.status) !== 200) {
      throw new Error(`HTTP ${homepage.status} for ${HOMEPAGE_URL}`)
    }
    if (Number(homepage.status) !== 200 || !hasVerifiedLoginShellSignal(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('The verified Proventech HRMS login shell changed materially')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      signal?.throwIfAborted()
      const routePage = await fetchPage(routeUrl, { signal, requestTimeoutMs })
      signal?.throwIfAborted()
      if (![200, 404].includes(Number(routePage.status))) {
        throw new Error(`HTTP ${routePage.status} for ${routeUrl}`)
      }
      if (!isExpectedMissingCareerRoute(routePage)) {
        throw new Error(`The verified Proventech no-public-careers route changed materially: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createProventechScraper().run(options)

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
