import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { RIMINI_STREET_CATALOG } from './catalog.js'

export const SCRAPER_DIR = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RIMINI_STREET_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BASE_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|\u00a0/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const CAREERS_TITLE_PATTERN = /<title>\s*Rimini Street Careers &amp; Job Opportunities \| Rimini Street\s*<\/title>/i
const LEGACY_WORKDAY_BASE_URL = 'https://riministreet.wd1.myworkdayjobs.com/en-US/RiminiStreet'

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: SCRAPER_DIR,
})

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    if (url.origin === 'https://riministreet.wd1.myworkdayjobs.com') {
      url.pathname = url.pathname.replace(/^\/en-US(?=\/|$)/i, '')
    }
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return CAREERS_TITLE_PATTERN.test(page)
    && normalized.includes('See open positions')
    && normalized.includes('Workday')
    && normalized.includes('Rimini Street')
}

const isVerifiedWorkdayHandoffUrl = (value) => {
  try {
    return sameUrl(value, WORKDAY_BASE_URL) || sameUrl(value, LEGACY_WORKDAY_BASE_URL)
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayHandoffUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isVerifiedWorkdayHandoffUrl(match[1])) {
      return WORKDAY_BASE_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /rel=["']canonical["'][^>]*href=["']https:\/\/riministreet\.wd1\.myworkdayjobs\.com\/RiminiStreet["']/i.test(page)
    && /cx-jobs\.min\.js/i.test(page)
    && /tenant:\s*"riministreet"/i.test(page)
    && /siteId:\s*"RiminiStreet"/i.test(page)
    && /extraordinary enterprise software support powered by extraordinary people/i.test(page)
    && /Rimini Street Career Job Alerts/i.test(page)
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

const isTransientFirstPartyAccessFailure = (error) => {
  const status = Number(error?.status ?? error?.cause?.status)
  return status === 403
    || /HTTP 403|timed out|timeout/i.test(String(error?.message || ''))
}

export const createRiminiStreetScraper = ({
  fetchText = defaultFetchText,
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({ signal } = {}) {
    let careersHtml = null

    try {
      careersHtml = await (
        signal === undefined
          ? fetchText(CAREERS_URL)
          : fetchText(CAREERS_URL, { signal })
      )
    } catch (error) {
      if (!isTransientFirstPartyAccessFailure(error)) {
        throw error
      }
    }

    if (careersHtml != null) {
      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('Rimini Street verified first-party careers page no longer matches the trusted surface')
      }

      const verifiedWorkdayHandoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
      if (!sameUrl(verifiedWorkdayHandoffUrl, WORKDAY_BASE_URL)) {
        throw new Error('Rimini Street verified Workday handoff changed; refusing to guess the public jobs source')
      }
    }

    const workdayBoardHtml = await (
      signal === undefined
        ? fetchText(WORKDAY_BASE_URL)
        : fetchText(WORKDAY_BASE_URL, { signal })
    )
    assertWorkdayPageAvailable({ status: 200, html: workdayBoardHtml, url: WORKDAY_BASE_URL }, { source: SOURCE })
    if (!hasOfficialWorkdayBoardSignal(workdayBoardHtml)) {
      throw new Error('Rimini Street verified public Workday board changed materially')
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
} = {}) => createRiminiStreetScraper({ fetchText, workdayRunner }).run({ signal })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(SCRAPER_DIR, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
