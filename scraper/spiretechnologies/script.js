import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'

import SPIRE_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bcareers at\b/i,
  /jobs\.[a-z0-9.-]+\//i,
]

export const PROVIDER_METADATA = SPIRE_TECHNOLOGIES_CATALOG
export const SOURCE = SPIRE_TECHNOLOGIES_CATALOG.source
export const COMPANY = SPIRE_TECHNOLOGIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SPIRE_TECHNOLOGIES_CATALOG.officialBrandName
export const VERIFIED_ON = SPIRE_TECHNOLOGIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SPIRE_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = SPIRE_TECHNOLOGIES_CATALOG.officialCareersPageUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

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
  fetchImpl = fetch,
  timeoutMs = 15000,
  signal,
} = {}) => {
  signal?.throwIfAborted()
  const requestSignal = composeAbortSignals(signal, createTimeoutSignal(timeoutMs))
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: requestSignal,
    })

    signal?.throwIfAborted()
    requestSignal?.throwIfAborted()
    const html = await response.text()
    signal?.throwIfAborted()
    requestSignal?.throwIfAborted()
    return { status: response.status, url: response.url, html }
  } catch (error) {
    signal?.throwIfAborted()
    requestSignal?.throwIfAborted()
    throw error
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Smart Digital Marketing & Automation System')
    && normalized.includes('Spire Technologies gives you a ready system')
    && normalized.includes('At Spire Technologies, we provide pre-built, proven templates that are ready to use.')
    && normalized.includes('support@spiretechnologies.in')
    && normalized.includes('www.spiretechnologies.in')
    && normalized.includes('Spire Technologies. All Rights Reserved.')
  }

export const createSpireTechnologiesScraper = () => ({
  async run({ fetchPage: rawFetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    const fetchPage = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const page = await rawFetchPage(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return page
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const homepage = await fetchPage(CAREERS_PAGE_URL)

    if (Number(homepage?.status) !== 200 || !matchesExpectedUrl(homepage?.url, CAREERS_PAGE_URL)) {
      throw new Error('Spire Technologies verified official homepage no longer matches the known first-party surface')
    }

    if (pageExposesPublicJobListings(homepage?.html)) {
      throw new Error('Spire Technologies homepage now appears to expose public jobs')
    }

    if (!hasOfficialHomepageSignal(homepage?.html)) {
      throw new Error('Spire Technologies verified official homepage no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSpireTechnologiesScraper(options).run(options)

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
