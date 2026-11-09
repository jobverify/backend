import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import QUALSQUAD_INFOTECH_CATALOG from './catalog.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = QUALSQUAD_INFOTECH_CATALOG.source
export const COMPANY = QUALSQUAD_INFOTECH_CATALOG.companyName
export const PROVIDER_METADATA = QUALSQUAD_INFOTECH_CATALOG
export const VERIFIED_ON = QUALSQUAD_INFOTECH_CATALOG.verifiedOn
export const CANDIDATE_ROUTE_URLS = QUALSQUAD_INFOTECH_CATALOG.candidateRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url, options = {}) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
    ...options,
  })

export const isTrustedUnavailableFailure = (error) => {
  const message = String(error?.message ?? error).toLowerCase()

  return message.includes('enotfound')
    || message.includes('could not be resolved')
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('timed_out')
}

export const hasPublicJobsSurfaceSignal = (html) =>
  /\b(current openings|open positions|job openings|apply now)\b/i.test(String(html ?? ''))
    || /\/job(s)?\//i.test(String(html ?? ''))

const isBrowserFallbackError = (error) => {
  const message = String(error?.message ?? error).toLowerCase()

  return message.includes('fetch failed')
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('could not connect')
    || message.includes('und_err_connect_timeout')
}

export const run = async ({ fetchText = defaultFetchText, fetchBrowserText } = {}) => {
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

  try {
    for (const url of CANDIDATE_ROUTE_URLS) {
      try {
        const html = await fetchText(url, { attempts: 1 })
        if (hasPublicJobsSurfaceSignal(html)) {
          throw new Error('Qualsquad Infotech now exposes a public jobs surface')
        }
      } catch (error) {
        if (isTrustedUnavailableFailure(error)) {
          continue
        }

        if (!isBrowserFallbackError(error)) {
          throw error
        }

        try {
          const html = await browserTextFetcher(url)
          if (hasPublicJobsSurfaceSignal(html)) {
            throw new Error('Qualsquad Infotech now exposes a public jobs surface')
          }
        } catch (browserError) {
          if (isTrustedUnavailableFailure(browserError)) {
            continue
          }

          throw browserError
        }
      }
    }

    return []
  } finally {
    if (browserSession) {
      await browserSession.close()
    }
  }
}

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
