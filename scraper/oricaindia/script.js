import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { ORICA_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = ORICA_INDIA_CATALOG.source
export const COMPANY = ORICA_INDIA_CATALOG.companyName
export const PROVIDER_METADATA = ORICA_INDIA_CATALOG
export const BASE_URL = 'https://careers.orica.com'
export const DEFAULT_LOCALE = 'en_GB'
export const SEARCH_PATH = '/search/?createNewAlert=false&q=&locationsearch=India'
export const SEARCH_PAGE_URL = `${BASE_URL}${SEARCH_PATH}`
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

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
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized, BASE_URL)
    return url.origin === BASE_URL ? url.toString() : null
  } catch {
    return null
  }
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const monthIndexByName = new Map([
  ['jan', 1],
  ['feb', 2],
  ['mar', 3],
  ['apr', 4],
  ['may', 5],
  ['jun', 6],
  ['jul', 7],
  ['aug', 8],
  ['sep', 9],
  ['oct', 10],
  ['nov', 11],
  ['dec', 12],
])

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const shortDateMatch = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(normalized)
  if (shortDateMatch) {
    const month = monthIndexByName.get(shortDateMatch[2].toLowerCase())
    if (month) {
      return `${shortDateMatch[3]}-${String(month).padStart(2, '0')}-${shortDateMatch[1].padStart(2, '0')}`
    }
  }

  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return normalized
  return new Date(parsed).toISOString().slice(0, 10)
}

const isIndiaLocation = (value) => /(?:\bIN\b|\bIndia\b)/i.test(String(value ?? ''))

const normalizeIndiaLocation = (value) => {
  const normalized = stripTags(value)
  if (!normalized || !isIndiaLocation(normalized)) return null

  return normalized
    .replace(/,\s*IN\s*,/i, ', India,')
    .replace(/,\s*IN\b/i, ', India')
    .replace(/\bIN\b$/i, 'India')
}

export const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

export const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

export const buildSearchUrl = ({ startRow = null } = {}) => {
  const url = new URL(SEARCH_PATH, BASE_URL)
  if (Number.isInteger(startRow) && startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }
  return url.toString()
}

export const buildApplyUrl = (jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/talentcommunity/apply/${normalizeWhitespace(jobId) || ''}/?locale=${locale}`

export const hasOfficialSearchResultsSignal = (html) => {
  const page = String(html ?? '')

  return /Orica Jobs/i.test(page)
    && /class=["'][^"']*searchResultsShell[^"']*["']/i.test(page)
    && /class=["'][^"']*jobTitle-link[^"']*["']/i.test(page)
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi,
)]
  .map((match) => {
    const row = match[1]
    const sourceUrl = toAbsoluteUrl(
      extractFirst(/<a\b(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i, row),
    )
    const jobId = extractJobIdFromUrl(sourceUrl)
    const location = normalizeIndiaLocation(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )

    if (!sourceUrl || !jobId || !location) return null

    return {
      title: normalizeWhitespace(
        extractFirst(/<a\b[^>]*class=["'][^"']*jobTitle-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i, row),
      ),
      location,
      city: extractCity(location),
      jobId,
      requisitionId: jobId,
      sourceUrl,
      postingDate: normalizePostingDate(
        extractFirst(/<span\b[^>]*class=["'][^"']*jobDate[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
      ),
    }
  })
  .filter((job) => job?.title)

export const extractResultsSummary = (html) => {
  const label = stripTags(extractFirst(
    /<span\b[^>]*class=["'][^"']*paginationLabel[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))
  const helpText = stripTags(extractFirst(
    /<span\b[^>]*class=["'][^"']*srHelp[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))

  const pageMatch = /Page\s+(\d+)\s+of\s+(\d+)/i.exec(helpText || '')
  const labelNumbers = [...String(label ?? '').matchAll(/\d[\d,]*/g)]
    .map((match) => Number.parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite)

  const [start, end, totalResults] = labelNumbers
  const currentPage = pageMatch ? Number.parseInt(pageMatch[1], 10) : null
  const totalPages = pageMatch ? Number.parseInt(pageMatch[2], 10) : null

  return {
    totalResults: Number.isInteger(totalResults) ? totalResults : null,
    currentPage: Number.isInteger(currentPage) ? currentPage : null,
    totalPages: Number.isInteger(totalPages) ? totalPages : null,
    pageSize: Number.isInteger(start) && Number.isInteger(end) ? end - start + 1 : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const detailJobId = listing.jobId || extractJobIdFromUrl(listing.sourceUrl)
  const descriptionHtml = extractFirst(
    /itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  ) || extractFirst(
    /itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  const applyPath = normalizeWhitespace(
    extractFirst(/<a(?=[^>]*class="[^"]*\bdialogApplyBtn\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i, html),
  )
  const location = normalizeIndiaLocation(
    extractFirst(/<span\b[^>]*class=["'][^"']*jobGeoLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.location || null

  return {
    title: normalizeWhitespace(
      extractFirst(/<(?:span|h1)\b[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/(?:span|h1)>/i, html),
    ) || listing.title || null,
    location,
    city: extractCity(location) || listing.city || null,
    jobId: detailJobId || null,
    requisitionId: listing.requisitionId || detailJobId || null,
    employmentType: normalizeWhitespace(
      extractFirst(/data-careersite-propertyid=["'](?:employmentType|jobtype|shifttype)["'][^>]*>([\s\S]*?)<\/span>/i, html),
    ) || null,
    experienceRequired: null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizePostingDate(
      extractFirst(/itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, html),
    ) || listing.postingDate || null,
    closingDate: normalizePostingDate(
      extractFirst(/itemprop=["']validThrough["'][^>]*content=["']([^"']+)["']/i, html),
    ) || null,
    applyUrl: toAbsoluteUrl(applyPath) || buildApplyUrl(detailJobId),
    sourceUrl: listing.sourceUrl || null,
    department: null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createOricaIndiaScraper = () => ({
  async run({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()
    let startRow = 0
    let pageNumber = 1

    while (pageNumber <= maxPages) {
      const listingUrl = startRow > 0 ? buildSearchUrl({ startRow }) : SEARCH_PAGE_URL
      const listingHtml = await fetchText(listingUrl)

      if (pageNumber === 1 && !hasOfficialSearchResultsSignal(listingHtml)) {
        throw new Error('Response is not the verified official Orica jobs page')
      }

      const listings = extractSearchResults(listingHtml)
      const summary = extractResultsSummary(listingHtml)

      if (listings.length === 0) return jobs

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
        if (!isIndiaLocation(detail.location)) continue

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: COMPANY,
          department: detail.department || null,
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

      if (!summary.totalPages || pageNumber >= summary.totalPages) break
      startRow += summary.pageSize || listings.length
      pageNumber += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createOricaIndiaScraper().run(options)

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
