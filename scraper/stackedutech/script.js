import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'stackedutech'
export const COMPANY = 'StackEdutech'
export const HOMEPAGE_URL = 'http://stackedutech.com/'
export const WWW_HOMEPAGE_URL = 'http://www.stackedutech.com/'
export const EXPECTED_REDIRECT_URL =
  'https://superglasscharlottesville.com/headlight-restoration.html/'
export const ROBOTS_URL = 'https://stackedutech.com/robots.txt'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'http://stackedutech.com/careers',
  'http://stackedutech.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bapply now\b/i,
  /\bvacanc(?:y|ies)\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isStackEdutechHost = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'stackedutech.com' || hostname === 'www.stackedutech.com'
  } catch {
    return false
  }
}

const fetchWithTimeout = async (url, options, consumeResponse) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  timeout.unref?.()

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    return consumeResponse(response)
  } finally {
    clearTimeout(timeout)
  }
}

const defaultFetchPage = async (url) => {
  return fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  }, async (response) => {
    const html = await response.text()

    return {
      status: response.status,
      url,
      location: response.headers.get('location'),
      html,
    }
  })
}

const defaultFetchText = async (url) => {
  return fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/plain,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
  }, async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response.text()
  })
}

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizeWhitespace(value)))

export const isVerifiedHomepageRedirect = (page = {}) =>
  [301, 302, 307, 308].includes(Number(page.status))
  && isStackEdutechHost(page.url || HOMEPAGE_URL)
  && String(page.location || '') === EXPECTED_REDIRECT_URL
  && !hasPublicJobsSignal(page.html)

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const html = String(page.html ?? '')
  return Number(page.status) === 404
    && isStackEdutechHost(page.url || HOMEPAGE_URL)
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && /The requested URL was not found on this server\./i.test(html)
    && !hasPublicJobsSignal(html)
  }

export const hasVerifiedRobotsTxt = (text = '') => {
  const normalized = normalizeWhitespace(text).toLowerCase()
  return normalized.includes('content signals')
    && normalized.includes('search:')
    && normalized.includes('ai-input:')
    && normalized.includes('ai-train:')
    && !hasPublicJobsSignal(normalized)
  }

export const createStackEdutechScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!isVerifiedHomepageRedirect(homepage)) {
      throw new Error('StackEdutech verified homepage redirect no longer matches the sentinel')
    }

    const wwwHomepage = await fetchPage(WWW_HOMEPAGE_URL)
    if (!isVerifiedHomepageRedirect(wwwHomepage)) {
      throw new Error('StackEdutech verified homepage redirect no longer matches the sentinel')
    }

    const robotsTxt = await fetchText(ROBOTS_URL)
    if (!hasVerifiedRobotsTxt(robotsTxt)) {
      throw new Error('StackEdutech robots.txt no longer matches the verified no-jobs contract')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error('StackEdutech checked careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createStackEdutechScraper().run(options)

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
