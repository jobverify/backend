import path from 'path'
import { fileURLToPath } from 'url'

const BASE_URL = 'https://www.beroeinc.com'
const CAREER_PAGE_URL = `${BASE_URL}/careers-vacancies/`
const LISTING_URL = `${BASE_URL}/samples/ajax1.filtered-result1`
const DEFAULT_LIMIT = 9
const DEFAULT_REPORT_TAXO = 'india'
const currentDir = path.dirname(fileURLToPath(import.meta.url))

const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const repairMojibake = (value) => String(value || '')
  .replace(/â€“/g, '-')
  .replace(/â€”/g, '-')
  .replace(/â€˜|â€™/g, "'")
  .replace(/â€œ|â€�/g, '"')
  .replace(/Â/g, '')

const normalizeWhitespace = (value) => repairMojibake(decodeHtmlEntities(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value || '').replace(/<[^>]+>/g, ' '))

const extractFirst = (pattern, value) => {
  const match = String(value || '').match(pattern)
  return match ? match[1] : null
}

const toAbsoluteUrl = (value) => {
  const normalized = decodeHtmlEntities(value)
  if (!normalized) return null

  try {
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

const buildApplyUrl = (sourceUrl) => sourceUrl ? `${sourceUrl}#generic_cta` : null

const isIndiaLocation = (value) => /\bindia\b/i.test(normalizeWhitespace(value))

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^india(?:\s*-\s*remote|\s*\(\s*remote\s*\)|\s*,\s*remote)?$/i.test(part))
    .filter((part) => !/^remote$/i.test(part))

  const city = parts.find((part) => !/india/i.test(part))
  return city || null
}

const parseDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const cleaned = normalized.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
  const months = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  }

  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (match) {
    const [, day, monthName, year] = match
    const month = months[monthName.toLowerCase()]
    if (!month) return null
    return `${year}-${month}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(cleaned)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const slugFromUrl = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/g, '')
    return pathname.split('/').pop() || null
  } catch {
    return null
  }
}

const extractListItemsAfterHeading = (html, heading) => {
  const pattern = new RegExp(
    `<h2[^>]*>\\s*${heading}\\s*<\\/h2>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
    'i',
  )
  const section = extractFirst(pattern, html)
  if (!section) return []

  return [...section.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

export const buildListingUrl = () => LISTING_URL

export const buildListingRequestBody = ({
  offset = 0,
  limit = DEFAULT_LIMIT,
  reportTaxo = DEFAULT_REPORT_TAXO,
} = {}) => new URLSearchParams({
  report_taxo: reportTaxo,
  offset: String(Math.max(0, Number(offset) || 0)),
  limit: String(Math.max(1, Number(limit) || DEFAULT_LIMIT)),
}).toString()

export const extractListingSummary = (html) => ({
  totalCount: Number.parseInt(
    extractFirst(/<div id="get-totlal"[^>]*>(\d+)<\/div>/i, html) || '0',
    10,
  ) || 0,
})

export const extractListings = (html) => [...String(html || '').matchAll(
  /<div class="col-12 card-wrapper[\s\S]*?<div class="location[\s\S]*?<span>Location:<\/span><span>([\s\S]*?)<\/span>[\s\S]*?<h3 class="font-size-larger\s+post_title">([\s\S]*?)<\/h3>[\s\S]*?<div class="deadline[\s\S]*?">Deadline:\s*([\s\S]*?)<\/div>[\s\S]*?<a href="([^"]+)" class="btn-secondary1">/gi,
)]
  .map((match) => {
    const location = normalizeWhitespace(match[1])
    if (!isIndiaLocation(location)) return null

    const title = normalizeWhitespace(match[2])
    const sourceUrl = toAbsoluteUrl(match[4])
    const jobId = slugFromUrl(sourceUrl)

    if (!title || !sourceUrl || !jobId) return null

    return {
      title,
      company: 'Beroe',
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: buildApplyUrl(sourceUrl),
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: parseDate(match[3]),
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const contentHtml = extractFirst(
    /<div class="content-wrapper">([\s\S]*?)<div class="form-wrapper"\s+id="generic_cta">/i,
    html,
  ) || ''
  const descriptionText = stripTags(
    contentHtml
      .replace(/<\/li>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' '),
  )

  return {
    title: normalizeWhitespace(
      extractFirst(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i, html),
    ) || listing.title || null,
    company: 'Beroe',
    department: null,
    location: normalizeWhitespace(
      extractFirst(/Location\s*<\/div>\s*<div class="font-size-smaller font-medium">\s*([\s\S]*?)\s*<\/div>/i, html),
    ) || listing.location || null,
    city: extractCity(
      extractFirst(/Location\s*<\/div>\s*<div class="font-size-smaller font-medium">\s*([\s\S]*?)\s*<\/div>/i, html),
    ) || listing.city || null,
    country: 'India',
    jobId: slugFromUrl(listing.sourceUrl) || listing.jobId || null,
    requisitionId: slugFromUrl(listing.sourceUrl) || listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: buildApplyUrl(listing.sourceUrl || null),
    employmentType: 'Full-time',
    experienceRequired: normalizeWhitespace(
      extractFirst(/Experience Required:\s*([^<]+)<\/strong>/i, html),
    ),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItemsAfterHeading(html, 'Required Skills\\s*&amp;\\s*Qualifications:'),
    postingDate: parseDate(
      extractFirst(/Posted On\s*<\/div>\s*<div class="font-size-smaller font-medium">\s*([\s\S]*?)\s*<\/div>/i, html),
    ),
    closingDate: listing.closingDate || null,
    jobDescription: descriptionText || null,
  }
}

const defaultFetchListings = async ({ url, body }) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,*/*;q=0.8',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
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

export const createBeroeScraper = ({
  limit = DEFAULT_LIMIT,
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run(options = {}) {
    const fetchListings = options.fetchListings || defaultFetchListings
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()
    let offset = 0
    let page = 0
    let totalCount = null

    while (page < maxPages && (totalCount == null || offset < totalCount)) {
      const body = buildListingRequestBody({ offset, limit })
      const listingHtml = await fetchListings({
        url: buildListingUrl(),
        body,
      })
      const summary = extractListingSummary(listingHtml)
      const listings = extractListings(listingHtml)

      totalCount = summary.totalCount
      if (!summary.totalCount && listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: detail.company || 'Beroe',
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'beroe',
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate || listing.closingDate,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      page += 1
      offset += limit
      if (!summary.totalCount || offset >= summary.totalCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createBeroeScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Beroe scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'beroe')
    console.log('DB result:', result)
    process.exit(0)
  }
}
