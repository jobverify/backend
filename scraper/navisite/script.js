import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

import { NAVISITE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PARENT_CAREERS_URL = PROVIDER_METADATA.parentCareersUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const isTrustedBlockedCareersPage = (page = {}) => {
  const status = Number(page.status)
  const finalUrl = String(page.url || CAREERS_URL)

  return (status === 403 || status === 429)
    && finalUrl === CAREERS_URL
    && hasBlockedCareersSignal(getPageHtml(page))
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Discover Opportunities at Navisite, Part of Accenture')
    && normalized.includes('All open positions at Navisite can be found on the Accenture Careers page')
    && normalized.includes('Once there, simply search')
    && /search[^.]*navisite/i.test(normalized)
}

export const hasBlockedCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Just a moment...')
    && normalized.includes('Enable JavaScript and cookies to continue')
}

export const createNaviSiteScraper = () => ({
  async run({ fetchPage, fetchText, fetchBrowserText } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const loadPage = async (url) => {
      if (typeof fetchPage === 'function') {
        return fetchPage(url)
      }

      if (typeof fetchText === 'function') {
        try {
          return {
            status: 200,
            url,
            html: await fetchText(url),
          }
        } catch (error) {
          if (!(typeof fetchBrowserText === 'function' || fetchBrowserText === undefined) || !isBrowserFallbackError(error)) {
            throw error
          }

          return {
            status: 200,
            url,
            html: await browserTextFetcher(url),
          }
        }
      }

      return defaultFetchPage(url)
    }

    try {
      const careersPage = await loadPage(CAREERS_URL)
      const careersHtml = getPageHtml(careersPage)

      if (isTrustedBlockedCareersPage(careersPage)) {
        return []
      }

      if (!hasOfficialCareersSignal(careersHtml) && !hasBlockedCareersSignal(careersHtml)) {
        throw new Error('NaviSite verified careers surface changed materially')
      }

      return []
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createNaviSiteScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
