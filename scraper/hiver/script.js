import path from 'node:path'
import { fileURLToPath } from 'node:url'

import HIVER_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HIVER_CATALOG.source
export const COMPANY = HIVER_CATALOG.companyName
export const CAREERS_URL = HIVER_CATALOG.companyCareerPage
export const PINPOINT_BOARD_URL = HIVER_CATALOG.officialPinpointBoardUrl
export const PINPOINT_POSTINGS_URL = HIVER_CATALOG.pinpointPostingsUrl
export const PINPOINT_RSS_URL = HIVER_CATALOG.pinpointRssUrl
export const VERIFIED_ON = HIVER_CATALOG.verifiedOn
export const PROVIDER_METADATA = HIVER_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const normalizeUrl = (value, baseUrl = PINPOINT_BOARD_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return normalized
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractPinpointBoardUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/hiverhq\.pinpointhq\.com\/?)["']/i)
  if (!match?.[1]) return null

  try {
    return `${new URL(match[1]).origin}/`
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const noOpenPositionsCount = (page.match(/No open positions currently/gi) || []).length

  return /<title>\s*Hiver[\s\S]*\|\s*Hiver Careers\s*<\/title>/i.test(page)
    && text.includes('see our open positions')
    && text.includes('open positions')
    && noOpenPositionsCount >= 1
    && text.includes('jobs@hiverhq.com')
    && sameUrl(extractPinpointBoardUrl(page), PINPOINT_BOARD_URL)
}

export const extractPinpointPostingsUrl = (html) => {
  const match = String(html ?? '').match(
    /["'](\/postings\.json|https:\/\/hiverhq\.pinpointhq\.com\/postings\.json)["']/i,
  )
  return match?.[1] ? normalizeUrl(match[1], PINPOINT_BOARD_URL) : null
}

export const hasOfficialPinpointEmptyBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Jobs at Hiver\s*\|\s*Hiver Careers\s*<\/title>/i.test(page)
    && text.includes('current opportunities')
    && /External::Jobs/i.test(page)
    && sameUrl(extractPinpointPostingsUrl(page), PINPOINT_POSTINGS_URL)
    && page.includes(PINPOINT_RSS_URL)
    && text.includes('there are currently no positions advertised')
    && text.includes('register your interest')
}

export const createHiverScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Hiver verified first-party careers page no longer matches the known public surface')
    }

    if (!sameUrl(extractPinpointBoardUrl(careersPage.html), PINPOINT_BOARD_URL)) {
      throw new Error('Hiver verified first-party careers page no longer links to the verified Pinpoint board')
    }

    const pinpointBoard = await fetchPage(PINPOINT_BOARD_URL)
    if (
      pinpointBoard.status !== 200
      || !sameUrl(pinpointBoard.url, PINPOINT_BOARD_URL)
      || !hasOfficialPinpointEmptyBoardSignal(pinpointBoard.html)
    ) {
      throw new Error('Hiver verified Pinpoint empty board changed materially or now exposes public openings')
    }

    if (!sameUrl(extractPinpointPostingsUrl(pinpointBoard.html), PINPOINT_POSTINGS_URL)) {
      throw new Error('Hiver verified Pinpoint board no longer advertises the verified postings feed')
    }

    return []
  },
})

export const run = async (options = {}) => createHiverScraper().run(options)

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
