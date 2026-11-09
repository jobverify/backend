import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import UNITED_ALLIANCE_TECHNOLOGY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = UNITED_ALLIANCE_TECHNOLOGY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) => {
  const message = String(error?.message || error || '').toLowerCase()
  return message.includes('fetch failed')
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('could not connect')
    || message.includes('und_err_connect_timeout')
}

export const isExpectedDomainResolutionFailure = (error) => {
  const message = String(error?.message || error || '').toLowerCase()
  return message.includes('could not resolve host')
    || message.includes('enotfound')
    || message.includes('getaddrinfo')
    || message.includes('name or service not known')
  }

export const createUnitedAllianceTechnologyScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText } = {}) {
    try {
      await fetchText(OFFICIAL_CAREERS_URL)
    } catch (error) {
      if (isExpectedDomainResolutionFailure(error)) {
        return []
      }

      if (!isBrowserFallbackError(error)) {
        throw error
      }

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
        await browserTextFetcher(OFFICIAL_CAREERS_URL)
      } catch (browserError) {
        if (isExpectedDomainResolutionFailure(browserError)) {
          return []
        }

        throw browserError
      } finally {
        if (browserSession) {
          await browserSession.close()
        }
      }
    }

    throw new Error('United Alliance Technology exact-name first-party domain became reachable and needs a dedicated scraper')
  },
})

export const run = async (options = {}) => createUnitedAllianceTechnologyScraper().run(options)

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
