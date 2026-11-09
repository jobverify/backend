import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createHiBobNativeInventory } from '../../scraper-support/hibob/nativeInventory.js'
import CATALOG, { NATIVE_CONFIG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://careers.sapiens.com'
const DEFAULT_LOCALE = 'en_US'
const PAGE_SIZE = 15
export const PROVIDER_METADATA = CATALOG
// Pure SuccessFactors helpers below preserve archived fixture contracts only.

export const SEARCH_PAGE_URL = `${BASE_URL}/search/?createNewAlert=false&q=&locationsearch=`

const COMPANY_NAME = 'Sapiens'
const SOURCE = 'sapiens'

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

const stripPageToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/section)\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(decodeHtmlEntities(value), BASE_URL)
    return url.origin === BASE_URL ? url.toString() : null
  } catch {
    return null
  }
}

const isIndiaLocation = (value) => /(?:\bIN\b|\bIndia\b)/i.test(String(value ?? ''))

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || !isIndiaLocation(normalized)) return null

  const city = normalized.split(',')[0]?.trim()
  return city ? `${city}, India` : 'India'
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const parsePostedDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractDetailJobId = (value) => normalizeWhitespace(
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value),
)

const extractMetaContent = (attribute, value, html) => normalizeWhitespace(
  extractFirst(
    new RegExp(`<meta\\b[^>]*${attribute}=["']${value}["'][^>]*content=["']([^"']+)["']`, 'i'),
    html,
  ),
)

const cleanDocumentTitle = (value) => normalizeWhitespace(value)
  ?.replace(/\s+job details\s*\|\s*sapiens\s*$/i, '')
  || null

const extractDetailTitle = (html, listing = {}) => normalizeWhitespace(
  extractFirst(
    /data-careersite-propertyid=["']title["'][^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  || extractMetaContent('property', 'og:title', html)
  || cleanDocumentTitle(extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html))
  || normalizeWhitespace(extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html))
  || listing.title,
)

const extractDetailDescription = (html, title) => {
  const pageText = stripPageToText(html)
  if (!pageText) return null

  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || null
  const normalizedPageText = pageText.toLowerCase()
  const titleIndex = normalizedTitle ? normalizedPageText.indexOf(normalizedTitle) : -1
  const narrativeIndex = normalizedPageText.indexOf('sapiens is on the lookout')
  const roleOverviewIndex = normalizedPageText.indexOf('explore your next role at sapiens')
  const startIndex = narrativeIndex >= 0
    ? narrativeIndex
    : (
        roleOverviewIndex >= 0
          ? roleOverviewIndex
          : (titleIndex >= 0 ? titleIndex : 0)
      )

  return normalizeWhitespace(pageText.slice(startIndex)) || null
}

export const buildSearchUrl = ({ startRow = 0 } = {}) => {
  const url = new URL('/search/', BASE_URL)
  url.searchParams.set('createNewAlert', 'false')
  url.searchParams.set('q', '')
  url.searchParams.set('locationsearch', '')

  if (Number(startRow) > 0) {
    url.searchParams.set('startrow', String(Number(startRow)))
  }

  return url.toString()
}

export const buildApplyUrl = (detailJobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/talentcommunity/apply/${normalizeWhitespace(detailJobId) || ''}/?locale=${locale}`

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi,
)]
  .map((match) => {
    const row = match[1]
    const sourceUrl = toAbsoluteUrl(
      extractFirst(/<a\b(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i, row),
    )
    const detailJobId = extractDetailJobId(sourceUrl)
    const rawLocation = normalizeWhitespace(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const location = normalizeIndiaLocation(rawLocation)

    if (!sourceUrl || !detailJobId || !location) return null

    return {
      title: normalizeWhitespace(
        extractFirst(/<a\b[^>]*class=["'][^"']*jobTitle-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i, row),
      ),
      location,
      city: extractCity(location),
      jobId: normalizeWhitespace(
        extractFirst(/<span\b[^>]*class=["'][^"']*jobFacility[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
      ),
      requisitionId: normalizeWhitespace(
        extractFirst(/<span\b[^>]*class=["'][^"']*jobFacility[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
      ),
      sourceUrl,
      detailJobId,
    }
  })
  .filter((job) => job?.title && job?.jobId)

export const extractPaginationSummary = (html) => {
  const summary = extractFirst(/Page\s+(\d+)\s+of\s+(\d+),\s+Results\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)/i, html, (match) => ({
    currentPage: Number.parseInt(match[1], 10),
    totalPages: Number.parseInt(match[2], 10),
    start: Number.parseInt(match[3], 10),
    end: Number.parseInt(match[4], 10),
    totalJobCount: Number.parseInt(match[5], 10),
  }))

  if (!summary) {
    return {
      currentPage: null,
      totalPages: null,
      totalJobCount: null,
      pageSize: null,
    }
  }

  return {
    currentPage: summary.currentPage,
    totalPages: summary.totalPages,
    totalJobCount: summary.totalJobCount,
    pageSize: summary.end - summary.start + 1,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const detailJobId = normalizeWhitespace(
    extractFirst(/jobID\s*:\s*(\d+)/i, html),
  ) || listing.detailJobId || extractDetailJobId(listing.sourceUrl)
  const rawLocation = normalizeWhitespace(
    extractFirst(/jobGeoLocation[^>]*>([\s\S]*?)<\/span>/i, html),
  )
  const location = normalizeIndiaLocation(rawLocation) || listing.location || null
  const descriptionHtml = extractFirst(
    /<div\b[^>]*class=["'][^"']*jobdescription[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    html,
  )
  const title = extractDetailTitle(html, listing)
  const description = stripTags(descriptionHtml) || extractDetailDescription(html, title)

  return {
    title: title || listing.title || null,
    location,
    city: extractCity(location) || listing.city || null,
    jobId: normalizeWhitespace(
      extractFirst(/data-careersite-propertyid=["']facility["'][^>]*>([\s\S]*?)<\/span>/i, html),
    ) || listing.jobId || null,
    requisitionId: normalizeWhitespace(
      extractFirst(/data-careersite-propertyid=["']facility["'][^>]*>([\s\S]*?)<\/span>/i, html),
    ) || listing.requisitionId || listing.jobId || null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: description,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: parsePostedDate(
      extractFirst(/itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, html),
    ) || listing.postingDate || null,
    closingDate: null,
    applyUrl: detailJobId ? buildApplyUrl(detailJobId) : null,
    sourceUrl: listing.sourceUrl || null,
    department: null,
    publicExperienceChecked: true,
  }
}

export const createSapiensScraper = (options = {}) => createHiBobNativeInventory(NATIVE_CONFIG, options)

export const run = async (options = {}) => createSapiensScraper().run(options)

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
