import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'toshiba'
export const COMPANY = 'Toshiba'
export const CAREERS_URL = 'https://www.global.toshiba/ww/recruit/corporate.html'
export const JOBS_HANDOFF_URL = 'https://www.global.toshiba/ww/recruit/corporate/ourteams/jump.html'
export const HRMOS_BOARD_URL = 'https://hrmos.co/pages/toshiba/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;|&#34;|&#8220;|&#8221;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(decodeHtml(value), baseUrl).toString()
  } catch {
    return null
  }
}

const isVerifiedHrmosBoardUrl = (value) => {
  if (!value) return false

  try {
    const url = new URL(value)
    const normalizedPath = url.pathname.replace(/\/+$/, '').toLowerCase()

    return url.hostname.toLowerCase() === 'hrmos.co'
      && (
        normalizedPath === '/pages/toshiba'
        || normalizedPath === '/pages/toshiba/jobs'
      )
  } catch {
    return false
  }
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('we turn on the promise of a new day.')
    && normalized.includes('job openings & apply')
    && (
      normalized.includes('toshiba is not currently accepting applications.')
      || normalized.includes('life at toshiba')
    )
}

export const extractHandoffUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/job openings\s*&\s*apply/i.test(normalizeWhitespace(match[2]) || '')) continue

    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl) return absoluteUrl
  }

  return null
}

export const hasOfficialJobsHandoffSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('link to third-party website')
    && normalized.includes('move to hrmos recruitment page offered by bizreach, inc.')
    && normalized.includes('view jobs (hrmos)')
}

export const extractHrmosBoardUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/view jobs\s*\(hrmos\)/i.test(normalizeWhitespace(match[2]) || '')) continue

    const absoluteUrl = toAbsoluteUrl(match[1], JOBS_HANDOFF_URL)
    if (absoluteUrl) return absoluteUrl
  }

  return null
}

export const hasHrmosBoardSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return normalized.includes('\u682a\u5f0f\u4f1a\u793e\u6771\u829d \u63a1\u7528\u60c5\u5831')
    && normalized.includes('\u3053\u306e\u4f1a\u793e\u306e\u6c42\u4eba\u3092\u63a2\u3059')
    && normalized.includes('\u4ef6\u306e\u691c\u7d22\u7d50\u679c\u3092\u8868\u793a\u3059\u308b')
    && normalized.includes('\u52e4\u52d9\u5730')
}

export const hasIndiaJobsSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /\bIndia\b/i.test(normalized) || normalized.includes('\u30a4\u30f3\u30c9')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createToshibaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Toshiba careers page no longer matches the verified official public careers surface')
    }

    const handoffUrl = extractHandoffUrl(careersHtml)
    if (handoffUrl !== JOBS_HANDOFF_URL) {
      throw new Error('Toshiba careers page no longer links to the verified official jobs handoff')
    }

    const handoffHtml = await fetchText(JOBS_HANDOFF_URL)
    if (!hasOfficialJobsHandoffSignal(handoffHtml)) {
      throw new Error('Toshiba official jobs handoff no longer matches the verified official jobs handoff')
    }

    const hrmosBoardUrl = extractHrmosBoardUrl(handoffHtml)
    if (!isVerifiedHrmosBoardUrl(hrmosBoardUrl)) {
      throw new Error('Toshiba official jobs handoff no longer points to the verified public HRMOS board')
    }

    const hrmosBoardHtml = await fetchText(hrmosBoardUrl)
    if (!hasHrmosBoardSignal(hrmosBoardHtml)) {
      throw new Error('Toshiba public HRMOS board no longer matches the verified public board surface')
    }

    if (hasIndiaJobsSignal(hrmosBoardHtml)) {
      throw new Error('Toshiba public jobs board now exposes India openings or changed shape')
    }

    return []
  },
})

export const run = async (options = {}) => createToshibaScraper().run(options)

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
