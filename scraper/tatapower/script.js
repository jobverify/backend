import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY = 'Tata Power'
export const SOURCE = 'tatapower'
export const BASE_URL = 'https://careers.tatapower.com'
export const CAREER_PAGE_URL = 'https://careers.tatapower.com/'
export const VIEW_ALL_JOBS_URL = 'https://careers.tatapower.com/viewalljobs/'
export const SEARCH_PATH = '/search/?createNewAlert=false&locationsearch=&optionsFacetsDD_customfield1=&optionsFacetsDD_customfield2=&optionsFacetsDD_dept=&q='
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
  if (!normalized.includes(',')) return null
  return normalized.split(',')[0]?.trim() || null
}

const extractStateFromLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 3) return parts[parts.length - 2]
  if (parts.length === 2 && /india/i.test(parts[1])) return parts[0]
  return null
}

export const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

export const hasOfficialSearchResultsSignal = (html) => {
  const page = String(html ?? '')

  return (
    /Tata Power/i.test(page)
    && /class="paginationLabel"/i.test(page)
    && /class="[^"]*\bjobTitle-link\b[^"]*"/i.test(page)
  ) || (
    /tatapower Jobs/i.test(page)
    && /id="tile-search-results-label"/i.test(page)
    && /id="job-tile-list"/i.test(page)
    && /class="[^"]*\bjobTitle-link\b[^"]*"/i.test(page)
  )
}

export const hasOfficialEmptyStateSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripTags(page) || ''

  return (/Tata Power/i.test(page) || /tatapower Jobs/i.test(page))
    && (
      (/id="noresults"/i.test(page)
        && /The 0 most recent jobs posted by tatapower are listed below for your convenience\./i.test(normalized))
      || /There are currently no open positions matching/i.test(normalized)
      || /The 0 most recent jobs posted by tatapower are listed below for your convenience\./i.test(normalized)
      || /Results\s*<b>\s*0\s*(?:to|-|–)\s*0\s*<\/b>\s*of\s*<b>\s*0\s*<\/b>/i.test(page)
    )
}

export const extractSearchResults = (html) => {
  const rows = [...String(html).matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)]

  const legacyResults = rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[1]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const relativeLink = normalizeWhitespace(
        extractFirst(/<a(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
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

  if (legacyResults.length > 0) {
    return legacyResults
  }

  return [...String(html).matchAll(/<li class="job-tile\b[\s\S]*?<\/li>/gi)]
    .map((tileMatch) => {
      const tileHtml = tileMatch[0]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i, tileHtml),
      )
      const relativeLink = normalizeWhitespace(
        extractFirst(/data-url="([^"]+)"/i, tileHtml)
          || extractFirst(/<a[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*href="([^"]+)"/i, tileHtml),
      )
      const department = normalizeWhitespace(
        extractFirst(/id="job-[^"]+-desktop-section-dept-value"[^>]*>\s*([\s\S]*?)\s*<\/div>/i, tileHtml),
      )
      const state = normalizeWhitespace(
        extractFirst(/id="job-[^"]+-desktop-section-customfield1-value"[^>]*>\s*([\s\S]*?)\s*<\/div>/i, tileHtml),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !sourceUrl || !jobId) return null

      return {
        title,
        department,
        location: state ? `${state}, India` : null,
        city: null,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        postingDate: null,
      }
    })
    .filter(Boolean)
}

export const extractResultsSummary = (html) => {
  const label = stripTags(extractFirst(
    /<span class="paginationLabel"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))
  const helpText = stripTags(extractFirst(
    /<span class="srHelp"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))

  const pageMatch = /Page\s+(\d+)\s+of\s+(\d+)/i.exec(helpText || '')
  const labelNumbers = [...String(label ?? '').matchAll(/\d[\d,]*/g)]
    .map((match) => Number.parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite)

  const [start, end, totalResults] = labelNumbers
  const currentPage = pageMatch ? Number.parseInt(pageMatch[1], 10) : null
  const totalPages = pageMatch ? Number.parseInt(pageMatch[2], 10) : null
  const tileLabel = stripTags(extractFirst(
    /<span id="tile-search-results-label"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))
  const tileTotalResults = Number.parseInt(extractFirst(/Showing\s+(\d+)\s+Jobs?/i, tileLabel || ''), 10)
  const dataRecordReturned = Number.parseInt(extractFirst(/data-record-returned="(\d+)"/i, html), 10)
  const dataPerPage = Number.parseInt(extractFirst(/data-per-page="(\d+)"/i, html), 10)

  return {
    totalResults: Number.isInteger(totalResults)
      ? totalResults
      : (Number.isInteger(tileTotalResults) ? tileTotalResults : null),
    currentPage: Number.isInteger(currentPage) ? currentPage : null,
    totalPages: Number.isInteger(totalPages)
      ? totalPages
      : (
        Number.isInteger(tileTotalResults) && Number.isInteger(dataPerPage) && dataPerPage > 0
          ? Math.ceil(tileTotalResults / dataPerPage)
          : null
      ),
    pageSize: Number.isInteger(start) && Number.isInteger(end)
      ? end - start + 1
      : (Number.isInteger(dataRecordReturned) ? dataRecordReturned : null),
  }
}

const extractDescriptionLocation = (descriptionHtml) =>
  normalizeWhitespace(extractFirst(/>\s*Location:\s*([^<]+)\s*</i, descriptionHtml))

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/<(?:span|h1)\b[^>]*itemprop="title"[^>]*>([\s\S]*?)<\/(?:span|h1)>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractFirst(
    /<span itemprop="description"[^>]*class="jobdescription"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/i,
    html,
  ) || extractFirst(
    /<span itemprop="description"[^>]*>\s*<span class="jobdescription"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  ) || extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  ) || extractFirst(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/i, html)
  const applyPath = normalizeWhitespace(
    extractFirst(/<a(?=[^>]*class="[^"]*\bdialogApplyBtn\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i, html),
  )
  const rawLocation = normalizeWhitespace(
    extractFirst(/<span class="jobGeoLocation">\s*([\s\S]*?)\s*<\/span>/i, html),
  ) || normalizeWhitespace(
    extractFirst(/itemprop="streetAddress" content="([^"]+)"/i, html),
  ) || listing.location || null
  const descriptionCity = extractDescriptionLocation(descriptionHtml)
  const listingState = extractStateFromLocation(listing.location)
  const hasPlaceholderIndiaLocation = /,\s*0,\s*India(?:,\s*0)?/i.test(rawLocation || '')
  const location = descriptionCity
    ? [descriptionCity, listingState, 'India']
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(', ')
    : (hasPlaceholderIndiaLocation ? listing.location || rawLocation : rawLocation)
  const department = normalizeWhitespace(
    extractFirst(/data-careersite-propertyid="department"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.department || null
  const employmentType = normalizeWhitespace(
    extractFirst(/data-careersite-propertyid="shifttype"[^>]*>([\s\S]*?)<\/span>/i, html),
  )
  const jobId = normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
  ) || listing.jobId || null

  return {
    title,
    department,
    location,
    city: descriptionCity || listing.city || (hasPlaceholderIndiaLocation ? null : extractCity(location)),
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType,
    experienceRequired: null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeWhitespace(
      extractFirst(/itemprop="datePosted" content="([^"]+)"/i, html),
    ) || listing.postingDate || null,
    closingDate: normalizeWhitespace(
      extractFirst(/itemprop="validThrough" content="([^"]+)"/i, html),
    ) || null,
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

export const createTataPowerScraper = () => {
  const run = async ({
    maxPages = config.maxPages,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) => {
    const jobs = []
    const seenJobIds = new Set()
    const pageLimit = Number.isInteger(maxPages) ? maxPages : Number.POSITIVE_INFINITY
    let startRow = 0
    let pageNumber = 1

    while (pageNumber <= pageLimit) {
      const listingHtml = await fetchText(buildSearchUrl(startRow || null))

      if (pageNumber === 1 && !hasOfficialSearchResultsSignal(listingHtml) && !hasOfficialEmptyStateSignal(listingHtml)) {
        throw new Error('Response is not the verified official Tata Power jobs page')
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

const scraper = createTataPowerScraper()

export const {
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Tata Power scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
