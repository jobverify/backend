import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'zebpay'
export const COMPANY = 'ZebPay'
export const VERIFIED_ON = '2026-07-25'
export const HOMEPAGE_URL = 'https://zebpay.com/'
export const CAREERS_URL = 'https://zebpay.com/careers'
export const CAREERS_EMAIL = 'careers@zebpay.com'
export const ZERO_OPENINGS_MESSAGE =
  "Dear all visitors, we don't have any openings currently. Please come back soon for exciting opportunities!"

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|\u2019/gi, "'")
  .replace(/&ndash;|&#8211;|\u2013/gi, '-')
  .replace(/&mdash;|&#8212;|\u2014/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const toComparableUrl = (value) => {
  try {
    const url = new URL(value)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.origin}${pathname}`
  } catch {
    return null
  }
}

const extractCanonicalUrl = (html = '') => {
  const match = String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
  return toComparableUrl(match?.[1])
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return extractTitle(html) === 'Careers - ZebPay'
    && extractCanonicalUrl(html) === CAREERS_URL
    && normalized.includes('Welcome to the Ohana')
    && normalized.includes('Benefits at Zebpay')
    && normalized.includes('Explore Opportunities')
}

export const hasVerifiedZeroOpeningsSignal = (html = '') =>
  hasOfficialCareersPageSignal(html)
  && normalizeWhitespace(html).includes(ZERO_OPENINGS_MESSAGE)

export const hasPublicOpeningSignal = (html = '') =>
  hasOfficialCareersPageSignal(html) && !hasVerifiedZeroOpeningsSignal(html)

export const createZebPayScraper = ({
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified ZebPay careers page changed materially')
    }

    if (hasVerifiedZeroOpeningsSignal(careersHtml)) {
      return []
    }

    if (hasPublicOpeningSignal(careersHtml)) {
      throw new Error('ZebPay careers surface now exposes public openings')
    }

    throw new Error('The verified ZebPay careers page no longer matches the known zero-openings state')
  },
})

export const run = async (options = {}) => createZebPayScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
