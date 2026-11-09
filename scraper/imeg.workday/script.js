import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://imegcorp.com/careers/'
export const WORKDAY_BASE_URL = 'https://wd1.myworkdaysite.com/recruiting/imeg/Imeg_Careers'
export const WORKDAY_DETAIL_URL_BASE = 'https://wd1.myworkdaysite.com/en-US/recruiting/imeg/Imeg_Careers'
export const WORKDAY_JOBS_API_URL = 'https://wd1.myworkdaysite.com/wday/cxs/imeg/Imeg_Careers/jobs'
export const COMPANY_NAME = 'IMEG'
export const SOURCE = 'imeg'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Design Consulting Jobs\s*-\s*IMEG\s*<\/title>/i
const CAREERS_HEADING_PATTERN = /<h1[^>]*>\s*Careers\s*<\/h1>/i
const CTA_PATTERN = />\s*View job opportunities\.\s*</i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_TITLE_PATTERN.test(page)
    && CAREERS_HEADING_PATTERN.test(page)
    && CTA_PATTERN.test(page)
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://wd1.myworkdaysite.com'
      && url.pathname === '/recruiting/imeg/Imeg_Careers'
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

export const createImegScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    const careersHtml = await (
      signal === undefined
        ? fetchText(CAREER_PAGE_URL)
        : fetchText(CAREER_PAGE_URL, { signal })
    )
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('IMEG official careers surface changed; refusing to guess the careers handoff')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('IMEG verified Workday handoff changed; refusing to guess the public jobs source')
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
} = {}) => createImegScraper({ fetchText, workdayRunner }).run({ signal })
