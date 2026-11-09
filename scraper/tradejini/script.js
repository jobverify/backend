import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'
import { TRADE_JINI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = TRADE_JINI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const OPEN_POSITIONS_URL = PROVIDER_METADATA.officialOpenPositionsUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;|â€™/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchText = async (url) => {
  const page = await fetchPageWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 20000,
  })

  return page.html
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>\s*careers at tradejini \| explore opportunities &amp; join our team\s*<\/title>/i.test(page)
    && normalized.includes('join our')
    && normalized.includes('passionate team')
    && normalized.includes('explore opportunities to grow, contribute, and make a real impact.')
    && normalized.includes('see open positions')
    && normalized.includes('our hiring process')
  }

export const extractOpenPositionsUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const linkText = normalizeWhitespace(match[2]).toLowerCase()
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)

    if (!absoluteUrl) continue

    if (absoluteUrl === OPEN_POSITIONS_URL || linkText.includes('open positions')) {
      return absoluteUrl
    }
  }

  return null
}

export const hasVerifiedOpenPositionsShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>\s*careers at tradejini \| explore opportunities &amp; join our team\s*<\/title>/i.test(page)
    && normalized.includes("let's power the journey for the top 1% of business leaders")
    && normalized.includes('search')
    && normalized.includes('trading made simple')
    && normalized.includes('quick links')
    && normalized.includes('crafted with care')
    && normalized.includes('attention investors & disclaimer')
}

export const hasPublicJobRecordsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /href=["'][^"']*\/careers\/open-positions\/[^"']+["']/i.test(page)
    || (
      normalized.includes('open positions')
      && normalized.includes('apply now')
    )
}

export const createTradeJiniScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml) || extractOpenPositionsUrl(careersHtml) !== OPEN_POSITIONS_URL) {
      throw new Error('TradeJini verified first-party careers shell no longer matches the trusted surface')
    }

    const openPositionsHtml = await fetchText(OPEN_POSITIONS_URL)

    if (hasPublicJobRecordsSignal(openPositionsHtml)) {
      throw new Error('TradeJini open-positions route now exposes public job records')
    }

    if (!hasVerifiedOpenPositionsShellSignal(openPositionsHtml)) {
      throw new Error('TradeJini verified open-positions route no longer matches the trusted first-party shell')
    }

    return []
  },
})

export const run = async (options = {}) => createTradeJiniScraper().run(options)

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
