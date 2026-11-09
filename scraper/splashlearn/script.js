import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SPLASHLEARN_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const PUBLIC_JOB_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjob title\b/i,
]

export const PROVIDER_METADATA = SPLASHLEARN_CATALOG
export const SOURCE = SPLASHLEARN_CATALOG.source
export const COMPANY = SPLASHLEARN_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SPLASHLEARN_CATALOG.officialBrandName
export const VERIFIED_ON = SPLASHLEARN_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SPLASHLEARN_CATALOG.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = SPLASHLEARN_CATALOG.officialCareersPageUrl

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

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(normalizeWhitespace(html)))

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Careers at SplashLearn')
    && normalized.includes('1 in 7 elementary school children in the US love SplashLearn!')
    && normalized.includes('Culture at SplashLearn')
    && normalized.includes('At SplashLearn, we dig individuality.')
    && normalized.includes('Meet Our Founders')
    && /Arpit Jain\s*-\s*CEO and a Co-founder\s*,?\s*SplashLearn\.?/i.test(normalized)
    && normalized.includes('StudyPad & SplashLearn are registered Trademarks of StudyPad, Inc.')
  }

export const createSplashLearnScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)

    if (
      Number(careersPage?.status) !== 200
      || !matchesExpectedUrl(careersPage?.url, CAREERS_PAGE_URL)
    ) {
      throw new Error('SplashLearn verified official careers page no longer matches the known first-party surface')
    }

    if (pageExposesPublicJobListings(careersPage?.html)) {
      throw new Error('SplashLearn careers page now appears to expose public jobs')
    }

    if (!hasOfficialCareersSignal(careersPage?.html)) {
      throw new Error('SplashLearn verified official careers page no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSplashLearnScraper(options).run(options)

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
