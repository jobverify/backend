import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

import { MASTEK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MASTEK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SEARCH_PAGE_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const BASE_URL = new URL(SEARCH_PAGE_URL).origin
export const DEFAULT_PAGE_SIZE = 12

const USER_AGENT =
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
    .replace(/<li\b[^>]*>/gi, '\n')
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

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractExperienceRequired = ({ title, jobDescription }) => (
  extractJobFilterSignals({
    title,
    jobDescription,
    experienceRequired: null,
  }).experienceProfile?.evidence || null
)

const escapeForRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeSearchUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const shortDateMatch = /^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/.exec(normalized)
  if (shortDateMatch) {
    const months = {
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
    const month = months[shortDateMatch[1].slice(0, 3).toLowerCase()]
    const day = shortDateMatch[2].padStart(2, '0')
    const year = shortDateMatch[3]

    if (month) return `${year}-${month}-${day}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  return parsed.toISOString().slice(0, 10)
}

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^IN$/i.test(normalized)) return 'India'
  if (/,\s*IN$/i.test(normalized)) return normalized.replace(/,\s*IN$/i, ', India')
  if (/\bIndia\b/i.test(normalized)) return normalized

  return null
}

export const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const extractSectionValueByLabel = (html, label) => {
  const matches = [...String(html ?? '').matchAll(
    new RegExp(
      `<span[^>]*class=["'][^"']*section-label[^"']*["'][^>]*>\\s*${escapeForRegex(label)}\\s*<\\/span>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`,
      'gi',
    ),
  )]

  for (const match of matches) {
    const value = normalizeWhitespace(match[1])
    if (value) return value
  }

  return null
}

export const buildSearchUrl = (startRow = null) => {
  const url = new URL('/search/', BASE_URL)

  if (Number.isInteger(startRow) && startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }

  return url.toString()
}

export const extractOfficialJobsBoardUrl = (html = '') => normalizeSearchUrl(
  extractFirst(
    /href=["'](https:\/\/careers\.mastek\.com\/search\/?)["']/i,
    html,
  ),
)

export const hasOfficialMastekCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const normalized = (normalizeWhitespace(page) || '').toLowerCase()

  return normalized.includes('mastek')
    && normalized.includes('explore jobs')
    && extractOfficialJobsBoardUrl(page) === SEARCH_PAGE_URL
}

export const hasOfficialSearchResultsSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Mastek Limited Jobs\s*<\/title>/i.test(page)
    && /id="job-tile-list"/i.test(page)
    && /class=["'][^"']*\bjobTitle-link\b/i.test(page)
    && /tile-search-results-label/i.test(page)
    && /jobRecordsFound:\s*parseInt\("\d+"\)/i.test(page)
}

export const hasOfficialEmptyStateSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Mastek Limited Jobs\s*<\/title>/i.test(page)
    && /jobRecordsFound:\s*parseInt\("0"\)/i.test(page)
}

export const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

export const countJobTiles = (html = '') => [...String(html ?? '').matchAll(
  /<li class="job-tile\b[\s\S]*?<\/li>/gi,
)].length

export const extractSearchResults = (html) => {
  const rows = [...String(html ?? '').matchAll(/<li class="job-tile\b[\s\S]*?<\/li>/gi)]

  return rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[0]
      const relativeLink = normalizeWhitespace(
        extractFirst(
          /<a(?=[^>]*class=["'][^"']*\bjobTitle-link\b[^"']*["'])(?=[^>]*href="([^"]+)")[^>]*>/i,
          rowHtml,
        ),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const title = normalizeWhitespace(
        extractFirst(
          /<a[^>]*class=["'][^"']*\bjobTitle-link\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
          rowHtml,
        ),
      )
      const location = normalizeIndiaLocation(extractSectionValueByLabel(rowHtml, 'Location'))
      const department = extractSectionValueByLabel(rowHtml, 'Department')
      const businessUnit = extractSectionValueByLabel(rowHtml, 'Business Unit')
      const requisitionId = extractSectionValueByLabel(rowHtml, 'Requisition ID')
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !sourceUrl || !jobId || !location) return null

      return {
        title,
        businessUnit,
        department,
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: requisitionId || jobId,
        sourceUrl,
        postingDate: normalizeDate(extractSectionValueByLabel(rowHtml, 'Date')),
      }
    })
    .filter(Boolean)
}

export const extractResultsSummary = (html = '') => ({
  totalResults: extractFirst(
    /jobRecordsFound:\s*parseInt\("(\d+)"\)/i,
    html,
    (match) => Number.parseInt(match[1], 10),
  ),
  pageSize: extractFirst(
    /jobRecordsPerPage:\s*parseInt\("(\d+)"\)/i,
    html,
    (match) => Number.parseInt(match[1], 10),
  ),
})

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(
    /itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  ) || extractFirst(
    /itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  const applyPath = normalizeWhitespace(
    extractFirst(
      /<a(?=[^>]*class=["'][^"']*\bdialogApplyBtn\b[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i,
      html,
    ),
  )
  const jobId = normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
  ) || listing.jobId || null
  const jobDescription = stripTags(descriptionHtml)
  const experienceRequired = extractExperienceRequired({
    title: listing.title || null,
    jobDescription,
  })

  return {
    title: listing.title || null,
    businessUnit: listing.businessUnit || null,
    department: listing.department || null,
    location: listing.location || null,
    city: listing.city || extractCity(listing.location),
    country: listing.country || 'India',
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: null,
    experienceRequired,
    jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeDate(
      extractFirst(/itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, html),
    ) || listing.postingDate || null,
    closingDate: normalizeDate(
      extractFirst(/itemprop=["']validThrough["'][^>]*content=["']([^"']+)["']/i, html),
    ),
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
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

const isExpectedOfficialCareers403Error = (error) =>
  /HTTP 403\b/i.test(String(error?.message ?? error))
  && String(error?.message ?? error).includes(OFFICIAL_CAREERS_URL)

export const createMastekScraper = () => ({
  async run({
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = null,
    fetchText = defaultFetchText,
    fetchBrowserText,
    now = () => new Date().toISOString(),
  } = {}) {
    let officialCareersHtml = null
    let officialCareersBlocked = false

    try {
      officialCareersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    } catch (error) {
      if (!isExpectedOfficialCareers403Error(error)) {
        throw error
      }

      officialCareersBlocked = true

      if (typeof fetchBrowserText === 'function') {
        officialCareersHtml = await fetchBrowserText(OFFICIAL_CAREERS_URL)
        officialCareersBlocked = false
      }
    }

    if (officialCareersHtml && !hasOfficialMastekCareersSignals(officialCareersHtml)) {
      if (typeof fetchBrowserText === 'function') {
        officialCareersHtml = await fetchBrowserText(OFFICIAL_CAREERS_URL)
      }
    }

    if (!officialCareersBlocked && !hasOfficialMastekCareersSignals(officialCareersHtml)) {
      throw new Error('Mastek verified official Mastek careers page no longer matches the known public surface')
    }

    const jobs = []
    const seenJobIds = new Set()
    const pageLimit = Number.isInteger(maxPages) ? maxPages : Number.POSITIVE_INFINITY
    let startRow = 0
    let pageNumber = 1

    while (pageNumber <= pageLimit) {
      const listingHtml = await fetchText(buildSearchUrl(startRow || null))

      if (
        pageNumber === 1
        && !hasOfficialSearchResultsSignal(listingHtml)
        && !hasOfficialEmptyStateSignal(listingHtml)
      ) {
        throw new Error('Response is not the verified official Mastek jobs page')
      }

      const rawTileCount = countJobTiles(listingHtml)
      if (rawTileCount === 0) return jobs

      const listings = extractSearchResults(listingHtml)
      const summary = extractResultsSummary(listingHtml)

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
          businessUnit: detail.businessUnit || listing.businessUnit || null,
          department: detail.department || listing.department || null,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country || 'India',
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

      const pageSize = summary.pageSize || DEFAULT_PAGE_SIZE
      if (!summary.totalResults || startRow + pageSize >= summary.totalResults) {
        break
      }

      startRow += pageSize
      pageNumber += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createMastekScraper().run(options)

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
