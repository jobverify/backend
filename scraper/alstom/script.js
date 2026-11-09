import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobsearch.alstom.com'
const SEARCH_PATH = '/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_department=&optionsFacetsDD_shifttype=&locale=en_GB'

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const limit = Math.max(1, Number.parseInt(concurrency, 10) || 1)
  const results = new Array(items.length)
  let nextIndex = 0
  let firstError = null

  const worker = async () => {
    while (!firstError) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) return

      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex)
      } catch (error) {
        firstError ||= error
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )

  if (firstError) throw firstError
  return results
}

export const buildIndiaSearchUrl = (startRow = null) => {
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

export const extractSearchResults = (html) => {
  const rows = [...String(html).matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)]

  return rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[1]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const relativeLink = normalizeWhitespace(
        extractFirst(/<a(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
      )
      const location = normalizeWhitespace(
        extractFirst(/<span class="jobLocation">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !location || !sourceUrl || !jobId) return null

      return {
        title,
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

  return {
    totalResults: Number.isInteger(totalResults) ? totalResults : null,
    currentPage: Number.isInteger(currentPage) ? currentPage : null,
    totalPages: Number.isInteger(totalPages) ? totalPages : null,
    pageSize: Number.isInteger(start) && Number.isInteger(end) ? end - start + 1 : null,
  }
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/<(?:span|h1)\b[^>]*itemprop="title"[^>]*>([\s\S]*?)<\/(?:span|h1)>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  ) || extractFirst(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/i, html)
  const applyPath = normalizeWhitespace(
    extractFirst(/class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "\s+href="([^"]+)"/i, html),
  )
  const jobId = normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
  ) || listing.jobId || null
  const city = listing.city || normalizeWhitespace(
    extractFirst(/itemprop="addressLocality" content="([^"]+)"/i, html),
  ) || null
  const postingDate = normalizeWhitespace(
    extractFirst(/itemprop="datePosted" content="([^"]+)"/i, html),
  )
  const closingDate = normalizeWhitespace(
    extractFirst(/itemprop="validThrough" content="([^"]+)"/i, html),
  )

  return {
    title,
    location: listing.location || null,
    city,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: 'Full-time',
    experienceRequired: listing.experienceRequired || null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate,
    closingDate,
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createAlstomScraper = () => {
  const run = async ({
    maxPages = config.maxPages,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    detailConcurrency = Number.isInteger(config.detailFetchConcurrency)
      ? config.detailFetchConcurrency
      : 4,
    fetchText = defaultFetchText,
  } = {}) => {
    const jobs = []
    const seenJobIds = new Set()
    let startRow = 0
    let pageNumber = 1

    while (pageNumber <= maxPages) {
      const listingHtml = await fetchText(buildIndiaSearchUrl(startRow || null))
      const listings = extractSearchResults(listingHtml)
      const summary = extractResultsSummary(listingHtml)

      if (listings.length === 0) break

      const remainingSlots = maxJobs == null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, maxJobs - jobs.length)
      const pageListings = []

      for (const listing of listings) {
        if (pageListings.length >= remainingSlots) break
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)
        pageListings.push(listing)
      }

      const pageJobs = await mapWithConcurrency(
        pageListings,
        detailConcurrency,
        async (listing) => {
          const detailHtml = await fetchText(listing.sourceUrl)
          const detail = extractJobDetail(detailHtml, listing)

          return {
            jobId: detail.jobId || listing.jobId,
            requisitionId: detail.requisitionId || listing.requisitionId,
            title: detail.title || listing.title,
            company: 'Alstom',
            department: null,
            location: detail.location || listing.location,
            city: detail.city || listing.city,
            link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
            applyUrl: detail.applyUrl || listing.sourceUrl,
            sourceUrl: detail.sourceUrl || listing.sourceUrl,
            source: 'alstom',
            employmentType: detail.employmentType,
            experienceRequired: detail.experienceRequired,
            jobDescription: detail.jobDescription,
            minimumQualification: detail.minimumQualification,
            preferredQualification: detail.preferredQualification,
            requiredSkills: detail.requiredSkills,
            postingDate: detail.postingDate || listing.postingDate,
            closingDate: detail.closingDate || null,
            scrapedAt: new Date().toISOString(),
          }
        },
      )

      jobs.push(...pageJobs)

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs
      }

      if (!summary.totalPages || pageNumber >= summary.totalPages) break
      startRow += summary.pageSize || listings.length
      pageNumber += 1
    }

    return jobs
  }

  return {
    buildIndiaSearchUrl,
    extractSearchResults,
    extractResultsSummary,
    extractJobDetail,
    run,
  }
}

const scraper = createAlstomScraper()

export const {
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Alstom scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'alstom')
    console.log('DB result:', result)
    process.exit(0)
  }
}
