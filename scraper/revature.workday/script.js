import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://www.revature.com/'
export const WORKDAY_BASE_URL = 'https://revature.wd1.myworkdayjobs.com/revaturecareers'
export const WORKDAY_DETAIL_URL_BASE = 'https://revature.wd1.myworkdayjobs.com/en-US/revaturecareers'
export const WORKDAY_JOBS_API_URL = 'https://revature.wd1.myworkdayjobs.com/wday/cxs/revature/revaturecareers/jobs'
export const COMPANY_NAME = 'Revature'
export const SOURCE = 'revature'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN = /<title>\s*AI-Native Talent Transformation Platform\s*\|\s*Revature\s*<\/title>/i
const CAREERS_TEXT_PATTERN = />\s*Careers At Revature\s*</i

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_TITLE_PATTERN.test(page) && CAREERS_TEXT_PATTERN.test(page)
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://revature.wd1.myworkdayjobs.com'
      && url.pathname === '/revaturecareers'
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
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir,
})

export const createRevatureScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    const homepageHtml = await (
      signal === undefined
        ? fetchText(CAREER_PAGE_URL)
        : fetchText(CAREER_PAGE_URL, { signal })
    )
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Revature official homepage surface changed; refusing to guess the careers handoff')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(homepageHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Revature verified Workday handoff changed; refusing to guess the public jobs source')
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
} = {}) => createRevatureScraper({ fetchText, workdayRunner }).run({ signal })
