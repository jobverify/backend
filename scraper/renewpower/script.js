import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { runPublishedReNewPartial } from './publishedLinkedIn.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY = 'ReNew Power'
export const SOURCE = 'renewpower'
export const BASE_URL = 'https://careers.renew.com'
export const CAREER_PAGE_URL = 'https://careers.renew.com/'
export const SEARCH_PATH = '/search/?createNewAlert=false&q=&locationsearch='
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

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

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractExperienceRequired = (descriptionHtml) => normalizeWhitespace(
  extractFirst(/Experience\s*range\s*:\s*([^<\n]+)/i, descriptionHtml),
)

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

  return /ReNew/i.test(page)
    && /Search results for/i.test(page)
    && /class="[^"]*\bjobTitle-link\b/i.test(page)
}

export const hasOfficialEmptyStateSignal = (html) => {
  const page = String(html ?? '')

  return /ReNew/i.test(page)
    && (
      /There are currently no open positions matching this category or location\./i.test(page)
      || /Showing\s*0\s*to\s*0\s*of\s*0\s*Jobs/i.test(page)
      || /The\s+0\s+most recent jobs posted/i.test(page)
    )
}

export const extractSearchResults = (html) => {
  const page = String(html)
  const rows = [...page.matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)]
  const tiles = [...page.matchAll(
    /<li class="job-tile[\s\S]*?data-url="([^"]+)"[\s\S]*?<\/li>/gi,
  )]

  const tableResults = rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[1]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const relativeLink = normalizeWhitespace(
        extractFirst(/<a(?=[^>]*class="[^"]*\bjobTitle-link\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
      )
      const department = normalizeWhitespace(
        extractFirst(/<span class="jobDepartment">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const location = normalizeWhitespace(
        extractFirst(/<span class="jobLocation">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const postingDate = normalizeWhitespace(
        extractFirst(/<span class="jobDate">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !location || !sourceUrl || !jobId) return null

      return {
        title,
        department,
        location,
        city: extractCity(location),
        jobId,
        requisitionId: jobId,
        sourceUrl,
        postingDate,
      }
    })
    .filter(Boolean)

  if (tableResults.length > 0) {
    return tableResults
  }

  return tiles
    .map((tileMatch) => {
      const relativeLink = normalizeWhitespace(tileMatch[1])
      const tileHtml = tileMatch[0]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i, tileHtml),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const jobId = extractJobIdFromUrl(sourceUrl)
      const department = normalizeWhitespace(
        extractFirst(/section-dept-value">([\s\S]*?)<\/div>/i, tileHtml),
      ) || normalizeWhitespace(
        extractFirst(/section-businessunit-value">([\s\S]*?)<\/div>/i, tileHtml),
      )
      const location = normalizeWhitespace(
        extractFirst(/section-country-value">([\s\S]*?)<\/div>/i, tileHtml),
      )

      if (!title || !sourceUrl || !jobId) return null

      return {
        title,
        department,
        location,
        city: extractCity(location),
        jobId,
        requisitionId: jobId,
        sourceUrl,
        postingDate: null,
      }
    })
    .filter(Boolean)
}

export const extractResultsSummary = (html) => {
  const page = String(html ?? '')
  const label = stripTags(extractFirst(
    /<span class="paginationLabel"[^>]*>([\s\S]*?)<\/span>/i,
    page,
  ))
  const helpText = stripTags(extractFirst(
    /<span class="srHelp"[^>]*>([\s\S]*?)<\/span>/i,
    page,
  ))

  const pageMatch = /Page\s+(\d+)\s+of\s+(\d+)/i.exec(helpText || '')
  const labelNumbers = [...String(label ?? '').matchAll(/\d[\d,]*/g)]
    .map((match) => Number.parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite)

  const [start, end, totalResults] = labelNumbers
  const currentPage = pageMatch ? Number.parseInt(pageMatch[1], 10) : null
  const totalPages = pageMatch ? Number.parseInt(pageMatch[2], 10) : null
  const listRowCount = Number.parseInt(
    extractFirst(/aria-rowcount="(\d+)"/i, page, (match) => match[1]) || '',
    10,
  )
  const recordsReturned = Number.parseInt(
    extractFirst(/data-record-returned="(\d+)"/i, page, (match) => match[1]) || '',
    10,
  )
  const configuredPageSize = Number.parseInt(
    extractFirst(/data-per-page="(\d+)"/i, page, (match) => match[1]) || '',
    10,
  )
  const fallbackPageSize = Number.isInteger(recordsReturned) && recordsReturned > 0
    ? recordsReturned
    : configuredPageSize

  return {
    totalResults: Number.isInteger(totalResults)
      ? totalResults
      : (Number.isInteger(listRowCount) ? listRowCount : null),
    currentPage: Number.isInteger(currentPage) ? currentPage : null,
    totalPages: Number.isInteger(totalPages)
      ? totalPages
      : (
          Number.isInteger(listRowCount) && Number.isInteger(fallbackPageSize) && fallbackPageSize > 0
            ? Math.ceil(listRowCount / fallbackPageSize)
            : null
        ),
    pageSize: Number.isInteger(start) && Number.isInteger(end)
      ? end - start + 1
      : (Number.isInteger(fallbackPageSize) ? fallbackPageSize : null),
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const descriptionHtml = extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    page,
  ) || extractFirst(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/i, page)
  const applyPath = normalizeWhitespace(
    extractFirst(/<a(?=[^>]*class="[^"]*\bdialogApplyBtn\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i, page),
  )
  const location = normalizeWhitespace(
    extractFirst(/<span class="jobGeoLocation">\s*([\s\S]*?)\s*<\/span>/i, page),
  ) || normalizeWhitespace(
    extractFirst(/itemprop="streetAddress" content="([^"]+)"/i, page),
  ) || listing.location || null
  const isFilled = /Sorry,\s*this position has been filled\./i.test(page)

  return {
    title: normalizeWhitespace(
      extractFirst(/<(?:span|h1)\b[^>]*itemprop="title"[^>]*>([\s\S]*?)<\/(?:span|h1)>/i, page),
    ) || listing.title || null,
    department: normalizeWhitespace(
      extractFirst(/data-careersite-propertyid="department"[^>]*>([\s\S]*?)<\/span>/i, page),
    ) || listing.department || null,
    location,
    city: listing.city || extractCity(location),
    jobId: normalizeWhitespace(
      extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
    ) || listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    employmentType: normalizeWhitespace(
      extractFirst(/data-careersite-propertyid="shifttype"[^>]*>([\s\S]*?)<\/span>/i, page),
    ),
    experienceRequired: extractExperienceRequired(descriptionHtml),
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeWhitespace(
      extractFirst(/itemprop="datePosted" content="([^"]+)"/i, page),
    ) || listing.postingDate || null,
    closingDate: normalizeWhitespace(
      extractFirst(/itemprop="validThrough" content="([^"]+)"/i, page),
    ) || null,
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
    isFilled,
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

export const createRenewPowerScraper = () => {
  const run = async (options = {}) => {
    if (!Object.hasOwn(options, 'fetchText') || options.fetchPublishedText) {
      return runPublishedReNewPartial({ ...options, source: SOURCE, company: COMPANY })
    }
    // Keep the explicit legacy transport seam for archived RMK parser consumers.
    const { maxPages = config.maxPages, maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null, fetchText = defaultFetchText, now = () => new Date().toISOString() } = options
    const jobs = []
    const seenJobIds = new Set()
    const pageLimit = Number.isInteger(maxPages) ? maxPages : Number.POSITIVE_INFINITY
    let startRow = 0
    let pageNumber = 1

    while (pageNumber <= pageLimit) {
      const listingHtml = await fetchText(buildSearchUrl(startRow || null))

      if (pageNumber === 1 && !hasOfficialSearchResultsSignal(listingHtml) && !hasOfficialEmptyStateSignal(listingHtml)) {
        throw new Error('Response is not the verified official ReNew jobs page')
      }

      const listings = extractSearchResults(listingHtml)
      const summary = extractResultsSummary(listingHtml)

      if (listings.length === 0) {
        return jobs
      }

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        if (detail.isFilled || !detail.applyUrl) {
          continue
        }

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

      if (!summary.totalPages || pageNumber >= summary.totalPages) break
      startRow += summary.pageSize || listings.length
      pageNumber += 1
    }

    return jobs
  }

  return {
    buildSearchUrl,
    hasOfficialSearchResultsSignal,
    hasOfficialEmptyStateSignal,
    extractSearchResults,
    extractResultsSummary,
    extractJobDetail,
    run,
  }
}

const scraper = createRenewPowerScraper()

export const {
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ReNew Power scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
