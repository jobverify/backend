import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const HOME_PAGE_URL = 'https://www.magna.com/'
export const CAREER_PAGE_URL = 'https://www.magna.com/careers'
export const WORKDAY_BASE_URL = 'https://wd3.myworkdaysite.com/recruiting/magna/Magna'
export const WORKDAY_DETAIL_URL_BASE = 'https://wd3.myworkdaysite.com/en-US/recruiting/magna/Magna'
export const WORKDAY_JOBS_API_URL = 'https://wd3.myworkdaysite.com/wday/cxs/magna/Magna/jobs'
export const COMPANY_NAME = 'Magna Automotive'
export const SOURCE = 'magnaautomotive'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOME_PAGE_TITLE_PATTERN = /<title>\s*Magna International - Forward\. For all\.\s*<\/title>/i
const CAREERS_TITLE_PATTERN = /<h1[^>]*>\s*Careers\s*<\/h1>/i
const OPEN_POSITIONS_PATTERN = /Show all open positions/i

const hasOfficialHomepageSignal = (html) => HOME_PAGE_TITLE_PATTERN.test(String(html ?? ''))

const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return CAREERS_TITLE_PATTERN.test(page) && OPEN_POSITIONS_PATTERN.test(page)
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://wd3.myworkdaysite.com'
      && url.pathname === '/recruiting/magna/Magna'
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayHandoffUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isVerifiedWorkdayHandoffUrl(match[1])) {
      return new URL(match[1]).toString()
    }
  }

  return null
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
  signal,
})

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BASE_URL,
  locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
  source: SOURCE,
  scraperDir,
})

export const createMagnaAutomotiveScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    const fetchVerifiedText = (url) => (
      signal === undefined ? fetchText(url) : fetchText(url, { signal })
    )
    const [homeHtml, careersHtml] = await Promise.all([
      fetchVerifiedText(HOME_PAGE_URL),
      fetchVerifiedText(CAREER_PAGE_URL),
    ])

    if (!hasOfficialHomepageSignal(homeHtml)) {
      throw new Error('Magna Automotive official homepage changed; refusing to guess the careers source')
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Magna Automotive official careers surface changed; refusing to guess the handoff')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Magna Automotive verified Workday handoff changed; refusing to guess the jobs source')
    }

    return workdayRunner({
      ...buildScraperOptions(),
      ...(signal === undefined ? {} : { signal }),
    })
  },
})

export const run = async ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
  signal,
} = {}) => createMagnaAutomotiveScraper({ fetchText, workdayRunner }).run({ signal })
