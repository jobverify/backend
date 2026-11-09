import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sterlinggtakeemobilityltd'
export const COMPANY = 'Sterling Gtake E-mobility Ltd'
export const HOMEPAGE_URL = 'https://www.sterlinggtake.com/'
export const CHECKED_ROUTE_URLS = [
  'https://www.sterlinggtake.com/careers/',
  'https://www.sterlinggtake.com/career/',
  'https://www.sterlinggtake.com/jobs/',
  'https://www.sterlinggtake.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VERIFIED_PARKED_TEXT_SIGNALS = [
  'www.sterlinggtake.com',
  'this domain is registered for one of our customers.',
  'visit this page to see how to register it as dns zone into your account.',
  'your web site will be displayed soon.',
  'domain parking',
]

const VERIFIED_PARKED_HTML_SIGNALS = [
  'logo-black-net-150x150.png',
  'https://www.cloudns.net/',
  'https://www.cloudns.net/wiki/article/29/',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /icims\.com/i,
]

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const fetchPageOnce = async (targetUrl) => {
    const response = await fetchImpl(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: createTimeoutSignal(timeoutMs),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  }

  try {
    return await fetchPageOnce(url)
  } catch (error) {
    const fallbackUrl = String(url || '').replace(/^https:/i, 'http:')
    const errorCode = String(error?.cause?.code || error?.code || '')

    if (
      fallbackUrl !== url
      && /sterlinggtake\.com/i.test(String(url || ''))
      && errorCode === 'ERR_TLS_CERT_ALTNAME_INVALID'
    ) {
      return fetchPageOnce(fallbackUrl)
    }

    throw error
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedParkedShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD XHTML 1\.0 Transitional\/\/EN"/i.test(rawHtml)
    && /<title>\s*www\.sterlinggtake\.com\s*<\/title>/i.test(rawHtml)
    && /<h1[^>]*>\s*www\.sterlinggtake\.com\s*<\/h1>/i.test(rawHtml)
    && VERIFIED_PARKED_TEXT_SIGNALS.every((signal) => normalized.includes(signal))
    && VERIFIED_PARKED_HTML_SIGNALS.every((signal) => rawHtml.includes(signal))
}

export const createSterlingGtakeEmobilityLtdScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasVerifiedParkedShellSignal(homepage.html)) {
      throw new Error('Sterling Gtake E-mobility Ltd verified parked shell no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Sterling Gtake E-mobility Ltd homepage now exposes a public jobs surface')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !hasVerifiedParkedShellSignal(routePage.html)) {
        throw new Error(`Sterling Gtake E-mobility Ltd checked first-party route changed: ${routePage.url || routeUrl}`)
      }

      if (hasPublicJobsSignal(routePage.html)) {
        throw new Error(`Sterling Gtake E-mobility Ltd checked first-party route now exposes public jobs: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSterlingGtakeEmobilityLtdScraper().run(options)

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
