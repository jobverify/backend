import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ihxprivatelimited'
export const COMPANY = 'IHX Private Limited'
export const HOMEPAGE_URL = 'https://www.ihx.in/'
export const VERIFIED_LINKEDIN_JOBS_URL = 'https://www.linkedin.com/company/ihx-india/jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_SIGNALS = [
  'Home - IHX Private Limited.',
  'IHX Private Limited.',
  'Transform the Way You Manage Healthcare',
  'Build the Digital Backbone of Healthcare Insurance',
  'At IHX, every platform decision impacts real-world healthcare journeys.',
  'A Perfios Company',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const isFirstPartyUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname === 'www.ihx.in' || url.hostname === 'ihx.in'
  } catch {
    return false
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return OFFICIAL_SIGNALS.every((signal) => normalized.includes(signal))
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.ihx\.in\/["']/i.test(rawHtml)
    && /"@type":"Organization"/.test(rawHtml)
    && /"name":"IHX Private Limited\."/.test(rawHtml)
    && /id="careers"/i.test(rawHtml)
}

export const extractExploreOpportunitiesUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href="([^"]+)"[^>]*>\s*Explore Opportunities\s*<\/a>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (absoluteUrl) {
      return absoluteUrl
    }
  }

  return null
}

export const pageExposesFirstPartyJobRecords = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  for (const match of rawHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    if (url.hash === '#careers' || url.hash === '#contact-us') continue
    if (url.pathname === '/' && !url.search) continue

    if (/\/(careers?|jobs?|openings?)(\/|$)/i.test(url.pathname)) {
      return true
    }
  }

  return normalized.includes('current openings')
    || normalized.includes('open positions')
    || normalized.includes('job openings')
    || normalized.includes('open roles')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIhxPrivateLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('IHX Private Limited homepage no longer matches the verified official careers surface')
    }

    const exploreOpportunitiesUrl = extractExploreOpportunitiesUrl(homepageHtml)
    if (exploreOpportunitiesUrl !== VERIFIED_LINKEDIN_JOBS_URL) {
      throw new Error('IHX Private Limited careers section no longer links to the verified LinkedIn handoff')
    }

    if (pageExposesFirstPartyJobRecords(homepageHtml)) {
      throw new Error('IHX Private Limited first-party public job records now appear on the verified official site')
    }

    return []
  },
})

export const run = async (options = {}) => createIhxPrivateLimitedScraper().run(options)

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
