import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mavenir'
export const COMPANY_NAME = 'Mavenir'
export const CAREER_PAGE_URL = 'https://www.mavenir.com/'
export const CAREERS_PAGE_URL = 'https://www.mavenir.com/about/careers/'
export const WORKDAY_BASE_URL = 'https://mavenir.wd1.myworkdayjobs.com/Mavenir_Careers'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_HOME_TITLE_PATTERN = /<title>\s*MAVENIR:\s*TELCO-FIRST\.\s*CLOUD-NATIVE\.\s*AI-BY-DESIGN\.\s*<\/title>/i
const HOME_CAREERS_LINK_PATTERN = /href=["']https:\/\/www\.mavenir\.com\/about\/careers\/["'][^>]*>\s*Careers\s*</i
const CAREERS_TITLE_PATTERN = /<title>\s*Careers\s*-\s*Mavenir\s*<\/title>/i

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: currentDir,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_HOME_TITLE_PATTERN.test(page) && HOME_CAREERS_LINK_PATTERN.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return CAREERS_TITLE_PATTERN.test(page)
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://mavenir.wd1.myworkdayjobs.com'
      && url.pathname === '/Mavenir_Careers'
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

export const createMavenirScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    const fetchVerifiedText = (url) => (
      signal === undefined ? fetchText(url) : fetchText(url, { signal })
    )
    const homepageHtml = await fetchVerifiedText(CAREER_PAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Mavenir official homepage surface changed; refusing to guess the careers handoff')
    }

    const careersHtml = await fetchVerifiedText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Mavenir official careers page changed; refusing to guess the public jobs source')
    }

    const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
    if (verifiedWorkdayHandoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Mavenir verified Workday handoff changed; refusing to guess the public jobs source')
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
} = {}) => createMavenirScraper({ fetchText, workdayRunner }).run({ signal })
