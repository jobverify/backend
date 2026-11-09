import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY = 'Tata Consulting Engineers Limited'
export const SOURCE = 'tataconsultingengineers'
export const BASE_URL = 'https://careers.tataconsultingengineers.com'
export const SEARCH_PATH = '/search/?q=&sortColumn=referencedate&sortDirection=desc'
export const DEFAULT_PAGE_SIZE = 25
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
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

const normalizeFieldValue = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^-?null$/i.test(normalized)) return null
  return normalized
}

const extractSectionValueByLabel = (html, label) => {
  const matches = [...String(html ?? '').matchAll(
    new RegExp(
      `<span[^>]*class="section-label"[^>]*>\\s*${label}\\s*<\\/span>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`,
      'gi',
    ),
  )]

  for (const match of matches) {
    const value = normalizeFieldValue(match[1])
    if (value) return value
  }

  return null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return normalized

  return new Date(parsed).toISOString().slice(0, 10)
}

const extractSectionFromDescription = (description, heading) => {
  const text = normalizeWhitespace(description)
  if (!text) return null

  const pattern = new RegExp(
    `\\b${heading}\\b\\s*(.+?)(?=\\b(?:Qualification|Key Responsibilities|Competencies|Skills|Education|About Us|Purpose & Scope of Position)\\b|$)`,
    'i',
  )

  return normalizeWhitespace(extractFirst(pattern, text))
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildSearchUrl = (startRow = null) => {
  const url = new URL(SEARCH_PATH, BASE_URL)
  if (Number.isInteger(startRow) && startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }
  return url.toString()
}

export const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

export const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

export const hasOfficialSearchResultsSignal = (html) => {
  const page = String(html ?? '')

  return /id="job-tile-list"/i.test(page)
    && /class="[^"]*\bjobTitle-link\b[^"]*"/i.test(page)
    && (/jobRecordsFound:\s*parseInt\("\d+"\)/i.test(page) || /Showing\s+\d+\s+to\s+\d+\s+of\s+\d+\s+Jobs/i.test(page))
}

export const extractSearchResults = (html) => {
  const rows = [...String(html ?? '').matchAll(/<li class="job-tile\b[\s\S]*?<\/li>/gi)]

  return rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[0]
      const relativeLink = normalizeWhitespace(
        extractFirst(/<a(?=[^>]*class="[^"]*\bjobTitle-link\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      if (!sourceUrl || /\/ecofirst\/job\//i.test(sourceUrl)) return null

      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const location = extractSectionValueByLabel(rowHtml, 'Location')
      const department = extractSectionValueByLabel(rowHtml, 'Department')
      const sector = extractSectionValueByLabel(rowHtml, 'Sector')
      const city = extractSectionValueByLabel(rowHtml, 'City') || extractCity(location)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !location || !jobId) return null

      return {
        title,
        department,
        sector,
        location,
        city,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        postingDate: null,
      }
    })
    .filter(Boolean)
}

export const extractResultsSummary = (html) => {
  const labelText = normalizeWhitespace(
    extractFirst(/<span id="tile-search-results-label"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || normalizeWhitespace(
    extractFirst(/<span class="paginationLabel"[^>]*>([\s\S]*?)<\/span>/i, html),
  )
  const rangeMatch = /Showing\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)\s+Jobs/i.exec(labelText || '')
  const pageSize = extractFirst(
    /jobRecordsPerPage:\s*parseInt\("(\d+)"\)/i,
    html,
    (match) => Number.parseInt(match[1], 10),
  ) ?? extractFirst(
    /data-per-page="(\d+)"/i,
    html,
    (match) => Number.parseInt(match[1], 10),
  )

  if (!rangeMatch) {
    return {
      totalResults: null,
      pageSize: Number.isInteger(pageSize) ? pageSize : null,
      startRow: null,
      endRow: null,
    }
  }

  const start = Number.parseInt(rangeMatch[1], 10)
  const end = Number.parseInt(rangeMatch[2], 10)
  const totalResults = Number.parseInt(rangeMatch[3], 10)

  return {
    totalResults: Number.isInteger(totalResults) ? totalResults : null,
    pageSize: Number.isInteger(pageSize) ? pageSize : null,
    startRow: Number.isInteger(start) ? Math.max(start - 1, 0) : null,
    endRow: Number.isInteger(end) ? end : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/<(?:span|h1)\b[^>]*itemprop="title"[^>]*>([\s\S]*?)<\/(?:span|h1)>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/i,
    html,
  ) || extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  const descriptionText = stripTags(descriptionHtml)
  const applyPath = normalizeWhitespace(
    extractFirst(/<a(?=[^>]*class="[^"]*\bdialogApplyBtn\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i, html),
  )
  const location = normalizeWhitespace(
    extractFirst(/<span class="jobGeoLocation">\s*([\s\S]*?)\s*<\/span>/i, html),
  ) || listing.location || null
  const jobId = normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
  ) || listing.jobId || null

  return {
    title,
    department: listing.department || null,
    sector: listing.sector || null,
    location,
    city: listing.city || extractCity(location),
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: null,
    experienceRequired: extractSectionFromDescription(descriptionText, 'Experience'),
    jobDescription: descriptionText,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeDate(
      extractFirst(/itemprop="datePosted" content="([^"]+)"/i, html),
    ) || normalizeDate(listing.postingDate),
    closingDate: normalizeDate(
      extractFirst(/itemprop="validThrough" content="([^"]+)"/i, html),
    ),
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTceScraper = () => ({
  async run({
    maxPages = config.maxPages,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()
    const pageLimit = Number.isInteger(maxPages) ? maxPages : Number.POSITIVE_INFINITY
    let startRow = 0
    let pageNumber = 1

    while (pageNumber <= pageLimit) {
      const listingHtml = await fetchText(buildSearchUrl(startRow || null))

      if (pageNumber === 1 && !hasOfficialSearchResultsSignal(listingHtml)) {
        throw new Error('Response is not the verified official Tata Consulting Engineers jobs page')
      }

      const listings = extractSearchResults(listingHtml)
      const summary = extractResultsSummary(listingHtml)

      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: COMPANY,
          department: detail.department || listing.department || null,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.sourceUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (
        !summary.totalResults
        || (summary.pageSize && startRow + summary.pageSize >= summary.totalResults)
      ) {
        break
      }

      startRow += summary.pageSize || listings.length || DEFAULT_PAGE_SIZE
      pageNumber += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createTceScraper().run(options)

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
