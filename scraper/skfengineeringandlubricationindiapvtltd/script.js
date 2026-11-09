import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'skfengineeringandlubricationindiapvtltd'
export const COMPANY = 'SKF Engineering and Lubrication India Pvt Ltd'
export const BASE_URL = 'https://career.skf.com'
export const CAREER_HOME_URL = `${BASE_URL}/`
export const SEARCH_URL = `${BASE_URL}/search/?q=&sortColumn=referencedate&sortDirection=desc`
export const DEFAULT_MAX_PAGES = 20
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const MONTH_INDEX = {
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
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
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

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const shortDateMatch = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(normalized)
  if (shortDateMatch) {
    const day = shortDateMatch[1].padStart(2, '0')
    const month = MONTH_INDEX[shortDateMatch[2].toLowerCase()]
    const year = shortDateMatch[3]
    return month ? `${year}-${month}-${day}` : normalized
  }

  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return normalized

  return new Date(parsed).toISOString().slice(0, 10)
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = location.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const countryToken = parts.at(-1) || null
  const country = countryToken === 'IN' ? 'India' : countryToken

  return {
    location,
    city,
    country,
  }
}

export const buildSearchUrl = (startRow = null) => {
  const url = new URL(SEARCH_URL)
  if (Number.isInteger(startRow) && startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }
  return url.toString()
}

export const isIndiaLocation = (value) => {
  const { country, location } = parseLocation(value)
  return country === 'India' || /(?:^|,\s*)India(?:$|[\s,)(-])/i.test(location || '')
}

export const hasOfficialCareerHomeSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*SKF Jobs\s*<\/title>/i.test(page)
    && /Welcome to SKF job postings!/i.test(page)
    && /Why work at SKF/i.test(page)
    && /career\.skf\.com\/search\//i.test(page)
}

export const hasOfficialSearchResultsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*SKF Jobs\s*<\/title>/i.test(page)
    && /Search results for/i.test(page)
    && /class="paginationLabel"/i.test(page)
    && /class="srHelp"/i.test(page)
}

export const extractSearchResults = (html) => {
  const rows = [...String(html ?? '').matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)]

  return rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[1]
      const sourceUrl = toAbsoluteUrl(
        extractFirst(/<a(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
      )
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const department = normalizeWhitespace(
        extractFirst(/<span class="jobDepartment">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const locationData = parseLocation(
        extractFirst(/<span class="jobLocation">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const postingDate = normalizeDate(
        extractFirst(/<span class="jobDate">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const jobId = extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, sourceUrl, (match) => match[1])

      if (!title || !sourceUrl || !jobId || !locationData.location) return null

      return {
        title,
        department,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        postingDate,
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

  return {
    totalResults: Number.isInteger(totalResults) ? totalResults : null,
    currentPage: pageMatch ? Number.parseInt(pageMatch[1], 10) : null,
    totalPages: pageMatch ? Number.parseInt(pageMatch[2], 10) : null,
    pageSize: Number.isInteger(start) && Number.isInteger(end) ? end - start + 1 : null,
  }
}

const extractDescriptionHtml = (html) =>
  extractFirst(
    /itemprop="description"[^>]*>\s*<span class="jobdescription">([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  ) || extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/(?:span|div)/i,
    html,
  )

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/<(?:span|h1)\b[^>]*itemprop="title"[^>]*>([\s\S]*?)<\/(?:span|h1)>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractDescriptionHtml(html)
  const applyPath = normalizeWhitespace(
    extractFirst(/<a(?=[^>]*class="[^"]*\bdialogApplyBtn\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i, html),
  )
  const locationData = parseLocation(
    extractFirst(/<span class="jobGeoLocation">\s*([\s\S]*?)\s*<\/span>/i, html),
  )
  const fallbackLocationData = !locationData.location
    ? parseLocation(extractFirst(/itemprop="streetAddress" content="([^"]+)"/i, html))
    : locationData
  const postingDate = normalizeDate(
    extractFirst(/itemprop="datePosted" content="([^"]+)"/i, html),
  ) || normalizeDate(listing.postingDate)
  const closingDate = normalizeDate(
    extractFirst(/itemprop="validThrough" content="([^"]+)"/i, html),
  )
  const applyUrl = toAbsoluteUrl(applyPath)
  const jobId = extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath, (match) => match[1])
    || listing.jobId
    || null

  return {
    title,
    department: listing.department || null,
    location: fallbackLocationData.location || listing.location || null,
    city: fallbackLocationData.city || listing.city || null,
    country: listing.country || fallbackLocationData.country || null,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate,
    closingDate,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createSkfEngineeringAndLubricationIndiaScraper = () => ({
  async run({
    maxPages = DEFAULT_MAX_PAGES,
    maxJobs = null,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careerHomeHtml = await fetchText(CAREER_HOME_URL)
    if (!hasOfficialCareerHomeSignal(careerHomeHtml)) {
      throw new Error('SKF jobs home no longer matches the verified official first-party surface')
    }

    const jobs = []
    const seenJobIds = new Set()
    const pageLimit = Number.isInteger(maxPages) ? maxPages : DEFAULT_MAX_PAGES
    let pageNumber = 1
    let startRow = null

    while (pageNumber <= pageLimit) {
      const searchHtml = await fetchText(buildSearchUrl(startRow))

      if (pageNumber === 1 && !hasOfficialSearchResultsSignal(searchHtml)) {
        throw new Error('SKF jobs search page no longer matches the verified public listings surface')
      }

      const allListings = extractSearchResults(searchHtml)
      const summary = extractResultsSummary(searchHtml)

      if (allListings.length === 0) {
        break
      }

      for (const listing of allListings) {
        if (!isIndiaLocation(listing.location) || seenJobIds.has(listing.jobId)) {
          continue
        }

        seenJobIds.add(listing.jobId)
        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        if (!detail.title || !detail.applyUrl) {
          throw new Error(`SKF job detail page no longer matches the verified public apply contract for ${listing.sourceUrl}`)
        }

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: COMPANY,
          department: detail.department || listing.department || null,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country || 'India',
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.sourceUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt: now(),
        })

        if (Number.isInteger(maxJobs) && maxJobs > 0 && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.totalPages || pageNumber >= summary.totalPages) {
        break
      }

      startRow = (summary.pageSize || allListings.length) * pageNumber
      pageNumber += 1
    }

    return jobs
  },
})

export const run = async (options = {}) =>
  createSkfEngineeringAndLubricationIndiaScraper().run(options)

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
