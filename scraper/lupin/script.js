import {createNativeScraper,nativeMetadata,readNativePosting as readPublishedNativePosting} from './native.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { LUPIN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = Object.freeze({...LUPIN_CATALOG,...nativeMetadata,verifiedSurfaceSummary:'First-party public native discovery with complete own models before caps; authoritative totals, own-model stability and employer-wide scope remain unverified.'})
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const INDIA_JOBS_URL = PROVIDER_METADATA.indiaJobsPageUrl
export const BASE_URL = 'https://careers.lupin.com'
export const PAGE_SIZE = 25

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x27;/gi, "'")
  .replace(/&#x2F;/gi, '/')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => normalizeWhitespace(value)?.replace(/\s*,\s*/g, ', ') || null

const extractCity = (location) => {
  const parts = normalizeLocation(location)?.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean) || []
  return parts[0] || null
}

const extractCountry = (location) => {
  const code = normalizeLocation(location)?.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean).at(-1)?.toUpperCase() || null
  if (code === 'IN') return 'India'
  return null
}

const extractJobIdFromUrl = (value) => extractFirst(
  /\/(\d+)\/?(?:[#?].*)?$/i,
  value,
  (match) => match[1],
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/)
  if (!match) return normalized

  const [, monthName, day, year] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) return normalized

  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

const extractSectionHtml = (html, label) => {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return extractFirst(
    new RegExp(`<h2[^>]*>\\s*${escaped}\\s*<\\/h2>\\s*([\\s\\S]*?)(?=<h2|<\\/span>|$)`, 'i'),
    html,
  )
}

const extractParagraphs = (html = '') => [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildIndiaJobsUrl = (offset = 0) => {
  if (!Number.isInteger(offset) || offset <= 0) {
    return INDIA_JOBS_URL
  }

  return `https://careers.lupin.com/go/Lupin-India/9891200/${offset}/?q=&sortColumn=referencedate&sortDirection=desc`
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''
  const text = (normalizeWhitespace(page) || '').toLowerCase()

  return title === 'Leading Global Pharmaceutical Company in India - Lupin'
    && text.includes('lupin')
    && text.includes('careers')
    && page.includes('careers.lupin.com')
}

export const hasOfficialCareersSignal = (html = '') => {
  const text = (normalizeWhitespace(html) || '').toLowerCase()

  return text.includes('lupin limited provides several opportunities')
    && text.includes('get more information about our current openings here')
    && text.includes('join us')
}

export const hasOfficialIndiaJobsPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return page.includes('https://careers.lupin.com/go/Lupin-India/9891200/')
    && /successfactors/i.test(page)
    && /jobTitle-link/i.test(page)
    && /searchresults/i.test(page)
    && text.includes('Lupin-India')
}

export const extractSearchResults = (html = '') => [...String(html ?? '').matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
  .map((rowMatch) => {
    const rowHtml = rowMatch[0]
    const relativeLink = normalizeWhitespace(
      extractFirst(/<a(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
    )
    const sourceUrl = toAbsoluteUrl(relativeLink)
    const title = normalizeWhitespace(
      extractFirst(/<a[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
    )
    const location = normalizeLocation(
      extractFirst(/<td[^>]*headers="hdrLocation"[^>]*>([\s\S]*?)<\/td>/i, rowHtml),
    )
    const jobId = extractJobIdFromUrl(sourceUrl)
    const postingDate = normalizeDate(
      extractFirst(/<td[^>]*headers="hdrDate"[^>]*>([\s\S]*?)<\/td>/i, rowHtml),
    )
    const country = extractCountry(location)

    if (!title || !sourceUrl || !jobId || country !== 'India') return null

    return {
      title,
      location,
      city: extractCity(location),
      country,
      jobId,
      requisitionId: null,
      sourceUrl,
      postingDate,
    }
  })
  .filter(Boolean)

export const extractResultsSummary = (html = '') => {
  const page = String(html ?? '')
  const totalResults = extractFirst(
    /Results\s*(?:<b>)?\s*\d+\s*(?:-|–|\?)\s*\d+\s*(?:<\/b>)?\s*of\s*(?:<b>)?\s*(\d+)\s*(?:<\/b>)?/i,
    page,
    (match) => Number.parseInt(match[1], 10),
  ) ?? extractFirst(
    /Results\s+\d+\s+to\s+\d+\s+of\s+(\d+)/i,
    page,
    (match) => Number.parseInt(match[1], 10),
  )
  const totalPages = extractFirst(
    /Page\s+\d+\s+of\s+(\d+)/i,
    page,
    (match) => Number.parseInt(match[1], 10),
  ) ?? (Number.isInteger(totalResults) ? Math.ceil(totalResults / PAGE_SIZE) : null)

  return {
    totalResults: Number.isInteger(totalResults) ? totalResults : null,
    pageSize: PAGE_SIZE,
    totalPages: Number.isInteger(totalPages) ? totalPages : null,
  }
}

export const extractJobDetail = (html = '', listing = {}, observedAt = new Date().toISOString()) => {
  const labels = listing.nativeLocations || listing.locations || [listing.location]
  return readPublishedNativePosting(html, {
    ...listing,
    requisitionId: null,
    nativeJobID: null,
    nativeEmployer: null,
    nativeDepartment: null,
    nativeBusiness: null,
    nativeLocations: labels,
    nativeLocationLabels: listing.nativeLocationLabels || labels,
    expectedLocationCount: listing.expectedLocationCount ?? labels.length,
  }, observedAt)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'lupin-official',
  timeoutMs: 20000,
})

export const createLupinScraper = (defaults = {}) => createNativeScraper({
  maxJobs: Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  ...defaults,
})

export const run = async (options = {}) => createLupinScraper().run(options)

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
