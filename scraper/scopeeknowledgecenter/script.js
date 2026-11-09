import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SCOPE_EKNOWLEDGE_CENTER_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_ROUTES = [
  HOMEPAGE_URL,
  'https://www.scopeknowledge.com/careers',
  'https://www.scopeknowledge.com/jobs',
  'https://www.scopeknowledge.com/join-us',
]
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => {
  try {
    const html = await fetchTextWithRetry(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      label: SOURCE,
      timeoutMs: 15000,
    })

    return { status: 200, url, html }
  } catch (error) {
    const message = String(error?.message ?? error)
    const statusMatch = message.match(/\bHTTP\s+(\d{3})\b/i)
    if (statusMatch) {
      return { status: Number(statusMatch[1]), url, html: message }
    }
    throw error
  }
}

const isCertificateBlockedMessage = (value) =>
  /certificate has expired|ERR_CERT_COMMON_NAME_INVALID|ERR_CERT_DATE_INVALID|ERR_CERT_AUTHORITY_INVALID/i
    .test(String(value ?? ''))

export const isBlockedResponse = ({ status, html } = {}) =>
  (Number(status) === 403 && /403|forbidden/i.test(String(html ?? '')))
  || (Number(status) === 0 && isCertificateBlockedMessage(html))

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const toBlockedErrorResponse = (url, error) => {
  const message = String(error?.message ?? error ?? '')
  if (!isCertificateBlockedMessage(message)) {
    return null
  }

  return {
    status: 0,
    url,
    html: message,
  }
}

export const createScopeEknowledgeCenterScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBrowserPage } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserPageFetcher = fetchBrowserPage || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchPage(url)
    })

    const fetchVerifiedPage = async (url) => {
      try {
        return await fetchPage(url)
      } catch (error) {
        const blockedResponse = toBlockedErrorResponse(url, error)
        if (blockedResponse) {
          return blockedResponse
        }

        if (!isBrowserFallbackError(error)) {
          throw error
        }

        try {
          return await browserPageFetcher(url)
        } catch (browserError) {
          const blockedBrowserResponse = toBlockedErrorResponse(url, browserError)
          if (blockedBrowserResponse) {
            return blockedBrowserResponse
          }

          throw browserError
        }
      }
    }

    try {
      const pages = []
      for (const url of CAREERS_ROUTES) {
        pages.push(await fetchVerifiedPage(url))
      }

      if (pages.every((page) => isBlockedResponse(page))) {
        return []
      }

      throw new Error('Scope eKnowledge Center verified exact-name surface changed materially')
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createScopeEknowledgeCenterScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
