import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import { CREDIT_SUISSE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = CREDIT_SUISSE_CATALOG.source
export const COMPANY = CREDIT_SUISSE_CATALOG.companyName
export const PROVIDER_METADATA = CREDIT_SUISSE_CATALOG
export const LEGACY_HOMEPAGE_URL = CREDIT_SUISSE_CATALOG.legacyHomepageUrl
export const LEGACY_CAREERS_URL = CREDIT_SUISSE_CATALOG.companyCareerPage
export const UBS_HOMEPAGE_URL = CREDIT_SUISSE_CATALOG.officialHomepageRedirectUrl
export const UBS_CAREERS_URL = CREDIT_SUISSE_CATALOG.officialCareersRedirectUrl
export const UBS_SEARCH_JOBS_URL = CREDIT_SUISSE_CATALOG.officialSearchJobsUrl
export const UBS_JOBS_BOARD_HOST = CREDIT_SUISSE_CATALOG.officialJobsBoardHost

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return null
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

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const hasUbsHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const hasCurrentUsIdentity = /<title[^>]*>\s*Our financial services in the United States of America\s*\|\s*UBS United States\s*<\/title>/i.test(rawHtml)
    && /<h1[^>]*>\s*UBS United States\s*<\/h1>/i.test(rawHtml)

  return /UBS (?:logo|home)/i.test(rawHtml)
    && (/UBS United States of America/i.test(normalized) || hasCurrentUsIdentity)
    && /Credit Suisse Individuals/i.test(normalized)
    && /Careers at UBS/i.test(normalized)
}

export const hasUbsCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers\s*\|\s*UBS Global\s*<\/title>/i.test(rawHtml)
    && /you've got what it takes/i.test(normalized)
    && /A career at UBS/i.test(normalized)
    && /\/global\/en\/careers\/search-jobs\.html/i.test(rawHtml)
}

export const hasUbsSearchJobsSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Search jobs\s*\|\s*UBS Global\s*<\/title>/i.test(rawHtml)
    && /Looking for a change\?/i.test(normalized)
    && /search our global job board/i.test(normalized)
    && rawHtml.includes('jobs.ubs.com')
    && /Professionals/i.test(normalized)
}

export const isVerifiedLegacyHomepageRedirect = (page = {}) =>
  page.status === 200
  && normalizeUrl(page.url) === normalizeUrl(UBS_HOMEPAGE_URL)
  && hasUbsHomepageSignal(page.html)

export const isVerifiedLegacyCareersRedirect = (page = {}) =>
  page.status === 200
  && normalizeUrl(page.url) === normalizeUrl(UBS_CAREERS_URL)
  && hasUbsCareersSignal(page.html)

export const isVerifiedUbsSearchJobsSurface = (page = {}) =>
  page.status === 200
  && normalizeUrl(page.url) === normalizeUrl(UBS_SEARCH_JOBS_URL)
  && hasUbsSearchJobsSignal(page.html)

export const createCreditSuisseScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(LEGACY_HOMEPAGE_URL)
    if (!isVerifiedLegacyHomepageRedirect(homepage)) {
      throw new Error('Credit Suisse legacy homepage no longer matches the verified UBS handoff surface')
    }

    const careersPage = await fetchPage(LEGACY_CAREERS_URL)
    if (!isVerifiedLegacyCareersRedirect(careersPage)) {
      throw new Error('Credit Suisse legacy careers page no longer matches the verified UBS careers redirect')
    }

    const searchJobsPage = await fetchPage(UBS_SEARCH_JOBS_URL)
    if (!isVerifiedUbsSearchJobsSurface(searchJobsPage)) {
      throw new Error('Credit Suisse UBS search jobs handoff no longer matches the verified official surface')
    }

    return []
  },
})

export const run = async (options = {}) => createCreditSuisseScraper().run(options)

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
