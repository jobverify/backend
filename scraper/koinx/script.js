import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'koinx'
export const COMPANY = 'KoinX'
export const VERIFIED_ON = '2026-08-14'
export const HOMEPAGE_URL = 'https://www.koinx.com/careers'
export const CAREERS_URL = 'https://wellfound.com/company/koinx/jobs'

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

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const hasVerifiedHandoff = /(?:angel\.co\/company\/koinx|wellfound\.com\/company\/koinx(?:\/jobs)?)/i.test(page)

  return /<title\b[^>]*>\s*Unleash Your Potential\s*\|\s*Exciting Career Opportunities At KoinX\s*\|\s*Join Our Team\s*<\/title>/i.test(page)
    && hasVerifiedHandoff
    && (
      (
        text.includes('Careers At KoinX')
        && text.includes('The Core of KoinX')
        && text.includes('Committed To Your Success')
      )
      || /<iframe/i.test(page)
    )
}

export const hasEmptyJobsSurfaceSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return /View\s+0\s+jobs/i.test(text)
    && /KoinX\s+hasn't\s+added\s+any\s+jobs\s+yet/i.test(text)
}

export const hasExpectedBlockedWellfoundSurface = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return (
    /<title\b[^>]*>\s*wellfound\.com\s*<\/title>/i.test(page)
      && (
        text.includes('Please enable JS and disable any ad blocker')
        || /captcha-delivery\.com|challenge-platform\/scripts\/jsd\/main\.js/i.test(page)
      )
  ) || (
    /<title\b[^>]*>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
      && (
        text.includes('Checking if the site connection is secure')
        || text.includes('Enable JavaScript and cookies to continue')
        || /Cloudflare Ray ID/i.test(text)
      )
  ) || (
    /<title\b[^>]*>\s*Security Check\s*\|\s*Wellfound\s*<\/title>/i.test(page)
      && (
        text.includes('403 / Security check')
        || text.includes('Before you continue, please verify your request.')
        || text.includes('We need to confirm that this request is coming from a real browser before we send you to Wellfound.')
      )
      && (
        text.includes('Enable JavaScript and cookies to continue')
        || /Cloudflare Ray ID/i.test(text)
        || text.includes('Back to Wellfound')
      )
  )
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createKoinXScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBrowserPage } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession()
      }

      return browserSession
    }

    const browserPageFetcher = fetchBrowserPage || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchPage(url)
    })

    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
        throw new Error('KoinX verified first-party careers page no longer matches the known handoff surface')
      }

      let jobsPage
      try {
        jobsPage = await fetchPage(CAREERS_URL)
      } catch (error) {
        if (!isBrowserFallbackError(error)) throw error
        jobsPage = await browserPageFetcher(CAREERS_URL)
      }

      if (hasEmptyJobsSurfaceSignal(jobsPage.html) || hasExpectedBlockedWellfoundSurface(jobsPage.html)) {
        return []
      }

      throw new Error('KoinX verified jobs surface changed or now exposes public jobs')
    } finally {
      if (browserSession) await browserSession.close()
    }
  },
})

export const run = async (options = {}) => createKoinXScraper().run(options)

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
