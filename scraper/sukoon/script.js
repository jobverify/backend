import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sukoon'
export const COMPANY = 'Sukoon'
export const CAREERS_URL = 'https://trysukoon.com/'
export const DISPOSITION = 'verified-exact-name-company-surface-no-public-listings'
export const VERIFIED_SURFACE_CONTRACT =
  'Verified on Tuesday, August 4, 2026 that https://trysukoon.com/ was the exact-name public Sukoon services surface for online counselling, life coaching, and Ruqyah sessions, and that no stable enumerable first-party jobs inventory was publicly verified.'

const EXACT_NAME_PATTERN = /\bSukoon\b/

const SERVICE_SIGNAL_PATTERNS = [
  /\bonline counselling\b/i,
  /\blife coaching\b/i,
  /\bruqyah sessions?\b/i,
  /\bfind guidance,\s*clarity\s*&?\s*inner peace with sukoon\b/i,
]

const LISTING_HEADLINE_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bavailable roles\b/i,
]

const LIKELY_JOB_PATHS = [
  /^\/careers\/[^/?#]+$/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const normalizeText = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const normalizePath = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const containsJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const extractSameOriginLinks = (html = '', pageUrl = CAREERS_URL) => {
  const baseUrl = new URL(pageUrl)
  const links = new Set()
  const matches = String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi,
  )

  for (const match of matches) {
    const href = match[1] || match[2] || match[3] || null

    try {
      const url = new URL(href, baseUrl)
      if (url.origin === baseUrl.origin) links.add(url.toString())
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return [...links]
}

const findPublicListingSignals = (html = '', careersUrl = CAREERS_URL) => {
  const careersPath = normalizePath(new URL(careersUrl).pathname)
  const text = normalizeText(html)
  const jobLinks = extractSameOriginLinks(html, careersUrl).filter((value) => {
    const path = normalizePath(new URL(value).pathname)
    return path !== careersPath && LIKELY_JOB_PATHS.some((pattern) => pattern.test(path))
  })

  return {
    hasJobPostingMarkup: containsJobPostingMarkup(html),
    hasListingHeadline: LISTING_HEADLINE_PATTERNS.some((pattern) => pattern.test(text)),
    jobLinks,
  }
}

const assertVerifiedSurface = (html = '') => {
  const text = normalizeText(html)

  if (!EXACT_NAME_PATTERN.test(text)) {
    throw new Error(
      'Sukoon page no longer matches the verified exact-name Sukoon public surface.',
    )
  }

  if (!SERVICE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(
      'Sukoon page no longer exposes the verified Sukoon services-marketplace signal.',
    )
  }
}

const assertNoPublicListings = (html = '', careersUrl = CAREERS_URL) => {
  const listingSignals = findPublicListingSignals(html, careersUrl)

  if (listingSignals.hasJobPostingMarkup) {
    throw new Error(
      'Sukoon page now exposes JobPosting markup; promote a real public jobs parser.',
    )
  }

  if (!listingSignals.hasListingHeadline && listingSignals.jobLinks.length === 0) return

  throw new Error(
    `Sukoon page now exposes first-party public job listings: ${listingSignals.jobLinks.join(', ') || 'listing headline detected'}`,
  )
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createSukoonScraper = ({ careersUrl = CAREERS_URL } = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(careersUrl)

    assertNoPublicListings(html, careersUrl)
    assertVerifiedSurface(html)

    return []
  },
})

export const run = async (options = {}) => createSukoonScraper().run(options)

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
