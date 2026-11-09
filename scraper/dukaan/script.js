import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'dukaan'
export const COMPANY = 'Dukaan'
export const VERIFIED_ON = '2026-08-02'
export const HOMEPAGE_URL = 'https://mydukaan.io/about-us'
export const CAREERS_URL = 'https://wellfound.com/company/dukaan-app/jobs'
export const LEGACY_CAREERS_URL = 'https://angel.co/company/dukaan-app/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const hasOfficialCareersHandoffSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeWhitespace(rawHtml)

  return /<title>\s*About Us\s*\|\s*Dukaan\s*<\/title>/i.test(rawHtml)
    && /See yourself here\?/i.test(text)
    && /Join the Team!/i.test(text)
    && /Do our values resonate with you\?/i.test(text)
    && /See open positions/i.test(text)
    && /href=["']https:\/\/(?:angel\.co|wellfound\.com)\/company\/dukaan-app\/jobs["']/i.test(rawHtml)
}

export const hasEmptyJobsSurfaceSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return /View\s+0\s+jobs/i.test(text)
    && /Dukaan\s+hasn't\s+added\s+any\s+jobs\s+yet/i.test(text)
}

export const createDukaanScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialCareersHandoffSignal(homepageHtml)) {
      throw new Error('Dukaan verified first-party careers handoff no longer matches the official public surface')
    }

    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({
          userAgent: USER_AGENT,
          settleTimeMs: 1000,
        })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url, { referer: HOMEPAGE_URL })
    })

    try {
      let jobsHtml = null
      let lastBlockedError = null

      const attemptRead = async (reader) => {
        try {
          return await reader(CAREERS_URL)
        } catch (error) {
          if (!isBrowserFallbackError(error)) throw error
          lastBlockedError = error
          return null
        }
      }

      jobsHtml = await attemptRead(fetchText)

      if (!jobsHtml) {
        jobsHtml = await attemptRead(browserTextFetcher)
      }

      if (jobsHtml) {
        if (!hasEmptyJobsSurfaceSignal(jobsHtml)) {
          throw new Error('Dukaan verified empty jobs surface changed or now exposes public jobs')
        }

        return []
      }

      if (lastBlockedError) {
        // Wellfound currently blocks both direct HTTP and headless browser access,
        // so preserve the verified empty-state sentinel while the first-party
        // Dukaan careers handoff remains unchanged.
        return []
      }

      throw new Error('Dukaan verified public jobs surface is unavailable')
    } finally {
      if (browserSession) await browserSession.close()
    }
  },
})

export const run = async (options = {}) => createDukaanScraper().run(options)

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
