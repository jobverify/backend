import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.irco.com'
const REGION_PATH = '/go/Middle-East%2C-India-and-Africa/9515600/'
const PAGE_SIZE = 25
const DEFAULT_LOCALE = 'en_US'

export const INDIA_SEARCH_URL = `${BASE_URL}${REGION_PATH}`

const COMPANY_NAME = 'Ingersoll Rand'
const SOURCE = 'ingersollrand'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toOfficialUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized, BASE_URL)
    return url.origin === BASE_URL ? url.toString() : null
  } catch {
    return null
  }
}

const extractJobIdFromUrl = (value) => extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value)

const isIndiaLocation = (location) => /(?:\bIN\b|\bIndia\b)/i.test(location ?? '')

const normalizePostingDate = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(text)
  if (!match) return text

  const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .indexOf(match[2])
  if (monthIndex < 0) return text

  return `${match[3]}-${String(monthIndex + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

const normalizeListingLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location || !isIndiaLocation(location)) return null

  const city = location.split(',')[0]?.trim()
  return city ? `${city}, India` : 'India'
}

const extractLabelValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return normalizeWhitespace(extractFirst(
    new RegExp(`<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i'),
    html,
  ))
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1)
  const offset = (pageNumber - 1) * PAGE_SIZE
  const pathSuffix = offset > 0 ? `${offset}/` : ''
  return `${INDIA_SEARCH_URL}${pathSuffix}?q=&sortColumn=referencedate&sortDirection=desc`
}

export const buildApplyUrl = (jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/talentcommunity/apply/${normalizeWhitespace(jobId) || ''}/?locale=${locale}`

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(/<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => {
    const row = match[1]
    const linkMatch = /<a\b(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/i.exec(row)
    const title = normalizeWhitespace(linkMatch?.[2])
    const sourceUrl = toOfficialUrl(linkMatch?.[1])
    const location = normalizeListingLocation(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const jobId = extractJobIdFromUrl(sourceUrl)
    const postingDate = normalizePostingDate(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobDate[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )

    if (!title || !location || !sourceUrl || !jobId) return null

    return {
      title,
      location,
      city: location.split(',')[0]?.trim() || null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      postingDate,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const currentPage = Number.parseInt(
    normalizeWhitespace(extractFirst(/Page\s+(\d+)\s+of\s+\d+/i, html)) || '',
    10,
  )
  const totalPages = Number.parseInt(
    normalizeWhitespace(extractFirst(/Page\s+\d+\s+of\s+(\d+)/i, html)) || '',
    10,
  )
  const totalJobCount = Number.parseInt(
    normalizeWhitespace(extractFirst(/Results\s+\d+\s+to\s+\d+\s+of\s+(\d+)/i, html)) || '',
    10,
  )

  return {
    hasNext: Number.isFinite(currentPage) && Number.isFinite(totalPages) ? currentPage < totalPages : false,
    currentPage: Number.isFinite(currentPage) ? currentPage : null,
    totalPages: Number.isFinite(totalPages) ? totalPages : null,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i, html)
  const title = normalizeWhitespace(
    extractFirst(/<(?:h1|span)\b[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/(?:h1|span)>/i, html),
  ) || listing.title || null
  const location = extractLabelValue(html, 'Location(s):') || listing.location || null

  return {
    title,
    location,
    city: location?.split(',')[0]?.trim() || listing.city || null,
    jobId: listing.jobId || extractJobIdFromUrl(listing.sourceUrl),
    requisitionId: extractLabelValue(html, 'Requisition ID:') || listing.requisitionId || null,
    employmentType: extractLabelValue(html, 'Type of position:') || null,
    experienceRequired: extractLabelValue(html, 'Work experience:') || null,
    jobDescription: stripTags(descriptionHtml),
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeWhitespace(
      extractFirst(/<meta\b[^>]*itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, html),
    ) || listing.postingDate || null,
    applyUrl: toOfficialUrl(
      extractFirst(/<a\b[^>]*class=["'][^"']*apply[^"']*["'][^>]*href=["']([^"']+)["']/i, html),
    ) || buildApplyUrl(listing.jobId),
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify Ingersoll Rand scraper)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createIngersollRandScraper = () => ({
  async run({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listingHtml = await fetchText(page === 1 ? INDIA_SEARCH_URL : buildSearchUrl({ page }))
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)

      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
        if (!isIndiaLocation(detail.location)) continue

        jobs.push({
          ...detail,
          company: COMPANY_NAME,
          link: detail.applyUrl || detail.sourceUrl,
          source: SOURCE,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      if (!summary.hasNext || (summary.totalPages && page >= summary.totalPages)) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createIngersollRandScraper().run(options)
