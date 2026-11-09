import { createAmpereNativeScraper } from './native.js'
import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'amperecomputing'
export const COMPANY = 'Ampere Computing'
export const CAREER_PAGE_URL = 'https://careers.amperecomputing.com/'
export const SEARCH_URL = 'https://careers.amperecomputing.com/search/jobs'
export const INDIA_SEARCH_URL = 'https://careers.amperecomputing.com/search/jobs/in/country/india'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const extractLabeledText = (html, className) => stripTags(
  html.match(new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i'))?.[1],
)

const HAS_JOB_DETAIL_LINK_PATTERN = /href=["'][^"']*(?:\/jobs\/\d+-[^"']+)["']/i

export const extractSearchResults = (html) => {
  const page = String(html ?? '')
  const results = []
  const cards = page.match(/<(?:div|li)[^>]+class=["'][^"']*(?:job-card|job-listing|job-search-result)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|li)>/gi) || []

  for (const card of cards) {
    const match = card.match(/href=["'](\/jobs\/(\d+)-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!match) continue

    const [, pathName, jobId, rawTitle] = match
    const location = extractLabeledText(card, 'job-location')
    if (!location || !/\bIndia\s*$/i.test(location)) continue

    results.push({
      title: stripTags(rawTitle),
      category: extractLabeledText(card, 'job-category'),
      location,
      jobId,
      sourceUrl: new URL(pathName, SEARCH_URL).toString(),
    })
  }

  if (results.length > 0) return results

  const seen = new Set()
  for (const match of page.matchAll(/<h3[^>]*class=["'][^"']*heading-6[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']*\/jobs\/(\d+)-[^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi)) {
    const [, pathName, jobId, rawTitle] = match
    const resultWindow = page.slice(match.index, match.index + 1600)
    const columns = [...resultWindow.matchAll(/<div[^>]*class=["'][^"']*large-3 columns[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)]
      .map((columnMatch) => stripTags(columnMatch[1]))
      .map((value) => value?.replace(/^(Category|Location):\s*/i, '').trim() || null)
      .filter(Boolean)
    const location = columns.find((value) => /\bIndia\s*$/i.test(value)) || null
    if (!location) continue

    const sourceUrl = new URL(pathName, SEARCH_URL).toString()
    if (seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    results.push({
      title: stripTags(rawTitle),
      category: columns[0] || null,
      location,
      jobId,
      sourceUrl,
    })
  }

  return results
}

export const hasOfficialSearchResultsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''
  const extractedListings = extractSearchResults(page)

  const hasStructuredSearchChrome = (
    /<title>\s*(?:Job Search Results|India Careers)\s*<\/title>/i.test(page)
    || text.includes('Job Search Results')
    || text.includes('India Careers')
  ) && /Showing\s+\d+\s*-\s*\d+\s+of\s+\d+\s+results/i.test(text)
    && /\bJob Title\b/i.test(text)
    && /\bCategory\b/i.test(text)
    && /\bLocation\b/i.test(text)

  const hasLegacyVerifiedListings = extractedListings.length > 0
    && HAS_JOB_DETAIL_LINK_PATTERN.test(page)

  return (hasStructuredSearchChrome && (HAS_JOB_DETAIL_LINK_PATTERN.test(page) || /\b0\s+results\b/i.test(text)))
    || hasLegacyVerifiedListings
}

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  const text = normalizeWhitespace(html) || ''

  return Number(page.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && /challenges\.cloudflare\.com/i.test(html)
    && text.includes('Enable JavaScript and cookies to continue')
}

export const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && getHeader(page, 'cf-mitigated').toLowerCase() === 'challenge'
    && hasVerifiedCloudflareChallengeSignal(page)
}

export const createAmpereComputingScraper = createAmpereNativeScraper

export const run = async (options = {}) => createAmpereComputingScraper().run(options)

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
