import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobs.intuit.com'
const INDIA_SEARCH_URL = `${BASE_URL}/location/india-jobs/27595/1269750/2`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
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
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const isoLike = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized)
  if (isoLike) {
    const [, year, month, day] = isoLike
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized)
  if (slashDate) {
    const [, day, month, year] = slashDate
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const extractJobPosting = (html) => {
  for (const match of String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1])
      const payloads = Array.isArray(parsed) ? parsed : [parsed]
      const jobPosting = payloads.find((item) => item?.['@type'] === 'JobPosting')
      if (jobPosting) return jobPosting
    } catch {
      // Ignore non-JSON or unrelated JSON-LD payloads.
    }
  }

  return null
}

const extractLocationFromJobPosting = (jobPosting = {}) => {
  const location = Array.isArray(jobPosting.jobLocation) ? jobPosting.jobLocation[0] : jobPosting.jobLocation
  const address = location?.address || {}
  const city = normalizeWhitespace(address.addressLocality)
  const country = normalizeWhitespace(address.addressCountry)

  if (!city && !country) return null
  if (!country) return city
  if (!city) return country
  return `${city}, ${country}`
}

const isIndiaLocation = (location) => /india/i.test(normalizeWhitespace(location) || '')

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1)
  return pageNumber === 1 ? INDIA_SEARCH_URL : `${INDIA_SEARCH_URL}/${pageNumber}`
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<a [^>]*class="sr-item"[^>]*>[\s\S]*?<\/a>/gi,
)]
  .map((match) => {
    const cardHtml = match[0]
    const href = extractFirst(/href="([^"]+)"/i, cardHtml)
    const jobId = normalizeWhitespace(extractFirst(/data-job-id="([^"]+)"/i, cardHtml))
    const title = normalizeWhitespace(extractFirst(/<h2>([\s\S]*?)<\/h2>/i, cardHtml))
    const location = normalizeWhitespace(extractFirst(/<span class="job-location">([\s\S]*?)<\/span>/i, cardHtml))
    const sourceUrl = toAbsoluteUrl(href)

    if (!title || !location || !jobId || !sourceUrl || !isIndiaLocation(location)) return null

    return {
      title,
      location,
      city: extractCity(location),
      jobId,
      requisitionId: jobId,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const currentPage = Number.parseInt(
    extractFirst(/data-current-page="(\d+)"/i, html) || '',
    10,
  )
  const totalPages = Number.parseInt(
    extractFirst(/data-total-pages="(\d+)"/i, html) || '',
    10,
  )
  const totalJobCount = Number.parseInt(
    extractFirst(/data-total-results="(\d+)"/i, html) || '',
    10,
  )
  const pageSize = Number.parseInt(
    extractFirst(/data-records-per-page="(\d+)"/i, html) || '',
    10,
  )

  return {
    currentPage: Number.isFinite(currentPage) ? currentPage : null,
    totalPages: Number.isFinite(totalPages) ? totalPages : null,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
    pageSize: Number.isFinite(pageSize) ? pageSize : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = extractJobPosting(html)
  const title = normalizeWhitespace(
    extractFirst(
      /<section id="job-detail-pull"[\s\S]*?<h1>([\s\S]*?)<\/h1>/i,
      html,
      (match) => stripTags(match[1]),
    ),
  ) || normalizeWhitespace(jobPosting?.title) || listing.title || null
  const location = normalizeWhitespace(
    extractFirst(
      /<span class="job-location-jd job-info[\s\S]*?<b>Location<\/b>([\s\S]*?)<\/span>/i,
      html,
      (match) => stripTags(match[1]),
    ),
  ) || extractLocationFromJobPosting(jobPosting) || listing.location || null
  const requisitionId = normalizeWhitespace(
    extractFirst(/<meta name="job-ats-req-id" content="([^"]+)"/i, html)
      || extractFirst(/<span class="job-id job-info"><b>Job ID<\/b>\s*([^<]+)/i, html),
  ) || normalizeWhitespace(jobPosting?.identifier) || listing.requisitionId || listing.jobId || null
  const department = normalizeWhitespace(
    extractFirst(
      /<span class="job-category-jd job-info"><b>Category<\/b>\s*([\s\S]*?)<\/span>/i,
      html,
      (match) => stripTags(match[1]),
    ),
  )
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<meta name="search-job-apply-url" content="([^"]+)"/i, html)
      || extractFirst(/<a[^>]+class="[^"]*job-apply[^"]*"[^>]+href="([^"]+)"/i, html),
  )
  const jobDescription = stripTags(jobPosting?.description) || null

  return {
    title,
    location,
    city: extractCity(location) || listing.city || null,
    jobId: requisitionId,
    requisitionId,
    employmentType: normalizeWhitespace(jobPosting?.employmentType),
    experienceRequired: null,
    jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(jobPosting?.datePosted || extractFirst(/<meta name="dimension19" content="([^"]+)"/i, html)),
    closingDate: null,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
    department,
  }
}

const fetchText = async (url) => {
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

export const run = async () => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY

  for (let page = 1; page <= maxPages; page += 1) {
    const listingHtml = await fetchText(buildSearchUrl({ page }))
    const listings = extractSearchResults(listingHtml)
    const summary = extractPaginationSummary(listingHtml)

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: 'Intuit',
        department: detail.department,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
        applyUrl: detail.applyUrl || null,
        sourceUrl: detail.sourceUrl || listing.sourceUrl,
        source: 'intuit',
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate,
        closingDate: detail.closingDate,
        scrapedAt: new Date().toISOString(),
      })
    }

    const totalPages = summary.totalPages || page
    if (page >= totalPages) break
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Intuit scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'intuit')
    console.log('DB result:', result)
    process.exit(0)
  }
}
