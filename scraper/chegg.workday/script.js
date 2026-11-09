import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SCRAPER_DIR = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'chegg'
export const COMPANY_NAME = 'Chegg'
export const WORKDAY_BASE_URL = 'https://osv-chegg.wd5.myworkdayjobs.com/Chegg'
export const CAREERS_PAGE_URL = WORKDAY_BASE_URL
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const USER_AGENT = 'JobverifyCareerScraper/1.0'

const CAREERS_TITLE_PATTERN = /<title>\s*Jobs(?:\s+at\s+Chegg)?\s*(?:\||-|&ndash;|&mdash;|&#8211;|&#8212;)\s*Chegg\s*<\/title>/i
const WORKDAY_LINK_PATTERN = /href=["']https:\/\/osv-chegg\.wd5\.myworkdayjobs\.com\/Chegg["'][^>]*>\s*View jobs\s*</i

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: SCRAPER_DIR,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const hasVerifiedWorkdayBoard = /\btenant\s*:\s*["']osv_chegg["']/i.test(page)
    && /\bsiteId\s*:\s*["']Chegg["']/i.test(page)
    && /<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/osv-chegg\.wd5\.myworkdayjobs\.com\/Chegg["'])[^>]*>/i.test(page)
  return hasVerifiedWorkdayBoard || (CAREERS_TITLE_PATTERN.test(page) && WORKDAY_LINK_PATTERN.test(page))
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://osv-chegg.wd5.myworkdayjobs.com'
      && url.pathname === '/Chegg'
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

export const fetchOfficialCareersPage = ({ fetchImpl = fetch, signal } = {}) => fetchTextWithRetry(
  CAREERS_PAGE_URL,
  {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  fetchImpl,
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
  signal,
  },
)

const defaultFetchText = (_url, { signal } = {}) => fetchOfficialCareersPage({ signal })

export const createCheggScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    const careersHtml = await (
      signal === undefined
        ? fetchText(CAREERS_PAGE_URL)
        : fetchText(CAREERS_PAGE_URL, { signal })
    )
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Chegg official jobs page changed; refusing to guess the public jobs source')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Chegg verified Workday handoff changed; refusing to guess the public jobs source')
    }

    return workdayRunner({
      ...buildScraperOptions(),
      boardIdentityVerified: true,
      ...(signal === undefined ? {} : { signal }),
    })
  },
})

export const run = async ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
  signal,
} = {}) => createCheggScraper({ fetchText, workdayRunner }).run({ signal })
