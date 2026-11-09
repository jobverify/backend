import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const BASE_URL = 'https://jobs.vistancenetworks.com/'
export const CAREER_PAGE_URL = new URL('go/RUCKUS-Jobs/9892600/', BASE_URL).toString()
export const MORE_RESULTS_API_PATH = 'tile-search-results/category/9892600'

const COMPANY_NAME = 'Ruckus Networks'
const SOURCE = 'ruckusnetworks'
const PAGE_SIZE = 25

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x2018;|&#8216;/gi, "'")
  .replace(/&#x2019;|&#8217;/gi, "'")
  .replace(/&#x201c;|&#8220;/gi, '"')
  .replace(/&#x201d;|&#8221;/gi, '"')
  .replace(/&#x2013;|&#8211;/gi, '-')
  .replace(/&#x2014;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '- ')
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
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

const toIsoDate = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const monthNames = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  }

  const simpleDateMatch = text.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/)
  if (simpleDateMatch) {
    const month = monthNames[simpleDateMatch[1].toLowerCase()]
    if (month != null) {
      return new Date(Date.UTC(Number(simpleDateMatch[3]), month, Number(simpleDateMatch[2])))
        .toISOString()
        .slice(0, 10)
    }
  }

  const verboseDateMatch = text.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+\d{2}:\d{2}:\d{2}\s+\w+\s+(\d{4})$/)
  if (verboseDateMatch) {
    const month = monthNames[verboseDateMatch[1].toLowerCase()]
    if (month != null) {
      return new Date(Date.UTC(Number(verboseDateMatch[3]), month, Number(verboseDateMatch[2])))
        .toISOString()
        .slice(0, 10)
    }
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const isIndiaLocation = (location) => /\bIndia\b/i.test(location ?? '')

export const buildMoreResultsUrl = (startRow) =>
  new URL(`${MORE_RESULTS_API_PATH}/?startrow=${encodeURIComponent(startRow)}`, BASE_URL).toString()

export const extractTotalJobs = (html) => {
  const total = Number(extractFirst(/Showing\s+\d+\s+to\s+\d+\s+of\s+(\d+)\s+Jobs/i, html))
  return Number.isFinite(total) ? total : null
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(/<li class="job-tile\b[\s\S]*?<\/li>/gi)]
  .map((match) => {
    const tile = match[0]
    const sourceUrl = toAbsoluteUrl(extractFirst(/data-url="([^"]+)"/i, tile))
      || toAbsoluteUrl(extractFirst(/<a\b[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*href="([^"]+)"/i, tile))
    const title = normalizeWhitespace(
      extractFirst(/<a\b[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i, tile),
    )
    const location = normalizeWhitespace(
      extractFirst(/section-location[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, tile),
    )
    const requisitionId = normalizeWhitespace(
      extractFirst(/section-customfield1[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, tile),
    )
    const department = normalizeWhitespace(
      extractFirst(/section-dept[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, tile),
    )
    const postingDate = toIsoDate(
      extractFirst(/section-date[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, tile),
    )
    const jobId = extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, sourceUrl)

    if (!title || !sourceUrl || !jobId || !location || !isIndiaLocation(location)) return null

    return {
      title,
      location,
      city: location.split(',')[0]?.trim() || null,
      jobId,
      requisitionId: requisitionId || null,
      department,
      postingDate,
      sourceUrl,
      applyUrl: sourceUrl,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(
    /<span[^>]*itemprop="description"[\s\S]*?<span class="jobdescription">([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  )
  const requiredSkills = [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
  const location = normalizeWhitespace(
    extractFirst(/<span class="jobGeoLocation">([\s\S]*?)<\/span>/i, html),
  ) || listing.location || null

  return {
    title: normalizeWhitespace(
      extractFirst(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i, html),
    ) || listing.title || null,
    location,
    city: location?.split(',')[0]?.trim() || listing.city || null,
    country: isIndiaLocation(location) ? 'India' : null,
    jobId: listing.jobId || extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, listing.sourceUrl),
    requisitionId: normalizeWhitespace(
      extractFirst(/data-careersite-propertyid="customfield1"[^>]*>([\s\S]*?)<\/span>/i, html),
    ) || listing.requisitionId || null,
    department: listing.department || null,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: toIsoDate(
      extractFirst(/<meta itemprop="datePosted" content="([^"]+)"/i, html),
    ) || listing.postingDate || null,
    closingDate: toIsoDate(
      extractFirst(/<meta itemprop="validThrough" content="([^"]+)"/i, html),
    ),
    jobDescription: stripTags(descriptionHtml),
    sourceUrl: listing.sourceUrl || null,
    applyUrl: toAbsoluteUrl(
      extractFirst(/<a\b[^>]*class="[^"]*\bapply\b[^"]*"[^>]*href="([^"]+)"/i, html),
    ) || listing.applyUrl || listing.sourceUrl || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: 'ruckusnetworks',
  timeoutMs: 15000,
})

export const createRuckusNetworksScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const maxJobs = Number.isInteger(options.maxJobs) ? options.maxJobs : null
    const firstPageHtml = await fetchText(CAREER_PAGE_URL)
    const totalJobs = extractTotalJobs(firstPageHtml)
    const pages = [firstPageHtml]

    if (totalJobs && totalJobs > PAGE_SIZE) {
      for (let startRow = PAGE_SIZE; startRow < totalJobs; startRow += PAGE_SIZE) {
        pages.push(await fetchText(buildMoreResultsUrl(startRow)))
      }
    }

    const listings = pages
      .flatMap((pageHtml) => extractSearchResults(pageHtml))
      .filter((listing, index, array) => array.findIndex((item) => item.jobId === listing.jobId) === index)
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const scrapedAt = new Date().toISOString()
    const jobs = []

    for (const listing of selectedListings) {
      const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
      if (!isIndiaLocation(detail.location)) continue

      jobs.push({
        ...detail,
        company: COMPANY_NAME,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createRuckusNetworksScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`Ruckus Networks jobs scraped: ${jobs.length}`)
}
