import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { loadNativePaginationDefaults, nativePaginationLimits, createNativePagination, readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)
const nativeDefaults = loadNativePaginationDefaults(currentDir)

const BASE_URL = 'https://careers.ey.com'
const SEARCH_PATH = '/ey/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_customfield1=&locale=en_US'
const DEFAULT_DETAIL_CONCURRENCY = 10

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&hellip;/gi, '…')
  .replace(/&ndash;|&#8211;|â€“/gi, '-')
  .replace(/&mdash;|&#8212;|â€”/gi, '-')
  .replace(/â€™/g, "'")
  .replace(/â€œ|â€/g, '"')
  .replace(/Â/g, '')

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
    return new URL(value, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
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

const normalizeLocation = (value) => normalizeWhitespace(value)
  ?.replace(/\s*\+\d+\s+more…?$/i, '')
  ?.trim() || null

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
      const locationHtml = extractFirst(
        /<span class="jobLocation">\s*([\s\S]*?)\s*<\/span>/i,
        rowHtml,
      )
      const location = normalizeLocation(stripTags(locationHtml))
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

const normalizeExperienceEvidence = (value) => normalizeWhitespace(value)
  ?.replace(
    /^(?:minimum|at\s+least)\s+(\d+(?:\.\d+)?)\s+(years?|months?)$/i,
    (_, minimum, unit) => `${minimum}+ ${unit.toLowerCase()}`,
  )
  ?.replace(
    /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+(years?|months?)$/i,
    (_, minimum, maximum, unit) => `${minimum}-${maximum} ${unit.toLowerCase()}`,
  )

const extractExperienceRequired = ({ title, jobDescription }) => (
  normalizeExperienceEvidence(
    extractJobFilterSignals({
      title,
      jobDescription,
      experienceRequired: null,
    }).experienceProfile?.evidence,
  ) || null
)

const extractDescriptionHtml = (html) => (
  extractFirst(
    /<span[^>]*class="jobdescription"[^>]*>([\s\S]*?)<\/span>\s*<\/span>(?=\s*<\/div>\s*<\/div>)/i,
    html,
  )
  || extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  )
  || extractFirst(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/i, html)
)

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractDescriptionHtml(html)
  const applyPath = normalizeWhitespace(
    extractFirst(/class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "\s+href="([^"]+)"/i, html),
  )
  const jobId = normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
  ) || normalizeWhitespace(extractFirst(/jobID\s*:\s*(\d+)/i, html)) || listing.jobId || null
  const city = listing.city || normalizeWhitespace(
    extractFirst(/itemprop="addressLocality" content="([^"]+)"/i, html),
  ) || null
  const jobDescription = stripTags(descriptionHtml)

  return {
    title,
    location: listing.location || null,
    city,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: 'Full-time',
    experienceRequired: extractExperienceRequired({
      title,
      jobDescription,
    }) || listing.experienceRequired || null,
    jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeWhitespace(
      extractFirst(/itemprop="datePosted" content="([^"]+)"/i, html),
    ),
    closingDate: normalizeWhitespace(
      extractFirst(/itemprop="validThrough" content="([^"]+)"/i, html),
    ),
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = (url, { signal } = {}) =>
  fetchTextWithRetry(url, {
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: config.retryAttempts,
    baseDelayMs: config.retryBaseDelayMs,
    timeoutMs: Math.max(config.jobListingTimeoutMs || 0, 30000),
    label: 'ey',
  })

export const createEyScraper = () => {
  const run = async ({
    maxPages,
    maxJobs,
    detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
    fetchText = defaultFetchText,
    signal,
    collectionBudgetMs,
  } = {}) => {
    signal?.throwIfAborted()
    const limits = nativePaginationLimits({ maxPages, maxJobs }, nativeDefaults)
    const pagination = createNativePagination({ surface: buildIndiaSearchUrl(), limits, signal, collectionBudgetMs })
    const jobs = []
    const completedPageJobs = []
    return pagination.run(jobs, async () => {
      const seenJobIds = new Set()
      let startRow = 0
      let pageNumber = 1

      while (pageNumber <= limits.maxPages) {
        const listingHtml = await readNativeWithSignal(() => fetchText(buildIndiaSearchUrl(startRow || null), { signal: pagination.signal }), pagination.signal)
        const listings = extractSearchResults(listingHtml)
        const summary = extractResultsSummary(listingHtml)

        const progress = pagination.page(listings.map(job => job.jobId), summary.totalResults)
        if (!progress) return pagination.finish(jobs, { exhausted: Boolean(summary.totalPages && pageNumber >= summary.totalPages) })

        const freshListings = []
        for (const listing of listings) {
          if (seenJobIds.has(listing.jobId)) continue
          seenJobIds.add(listing.jobId)
          freshListings.push(listing)
        }

        const remainingSlots = Math.max(limits.maxJobs - jobs.length, 0)
        const selectedListings = freshListings.slice(0, remainingSlots)
        const enrichedJobs = await mapWithConcurrency(
          selectedListings,
          detailConcurrency,
          async (listing, index) => {
            const detailHtml = await readNativeWithSignal(() => fetchText(listing.sourceUrl, { signal: pagination.signal }), pagination.signal)
            const detail = extractJobDetail(detailHtml, listing)

            const completed = {
              jobId: detail.jobId || listing.jobId,
              requisitionId: detail.requisitionId || listing.requisitionId,
              title: detail.title || listing.title,
              company: 'EY',
              department: null,
              location: detail.location || listing.location,
              city: detail.city || listing.city,
              link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
              applyUrl: detail.applyUrl || listing.sourceUrl,
              sourceUrl: detail.sourceUrl || listing.sourceUrl,
              source: 'ey',
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
            pagination.throwIfAborted()
            completedPageJobs[index] = completed
            return completed
          },
        )

        jobs.push(...enrichedJobs)
        completedPageJobs.length = 0
        if (jobs.length >= limits.maxJobs) {
          return pagination.finish(jobs)
        }

        if (!summary.totalPages || pageNumber >= summary.totalPages) return pagination.finish(jobs, { exhausted: Boolean(summary.totalPages) })
        startRow += summary.pageSize || listings.length
        pageNumber += 1
      }

      return pagination.finish(jobs)
    }, { flushCompleted: () => jobs.push(...completedPageJobs.filter(Boolean)) })
  }

  return {
    buildIndiaSearchUrl,
    extractSearchResults,
    extractResultsSummary,
    extractJobDetail,
    run,
  }
}

const scraper = createEyScraper()

export const {
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EY scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'ey')
    console.log('DB result:', result)
    process.exit(0)
  }
}
