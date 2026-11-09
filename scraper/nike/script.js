import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.nike.com'
const SEARCH_URL = `${BASE_URL}/jobs`
const INDIA_LOCATION_PATTERN = /\bindia\b|bengaluru|bangalore|hyderabad|chennai|pune|mumbai|gurgaon|gurugram|noida/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&amp;/gi, '&')
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
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toNikeUrl = (value, { jobOnly = false } = {}) => {
  if (!value) return null

  try {
    const url = new URL(decodeHtmlEntities(value), BASE_URL)
    if (url.origin !== BASE_URL) return null
    if (jobOnly && !/^\/[^?#]+\/job\/R-\d+\/?$/i.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

const extractJobPosting = (html) => {
  for (const match of String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1])
      const payloads = Array.isArray(parsed) ? parsed : [parsed]
      const posting = payloads.find((item) => item?.['@type'] === 'JobPosting')
      if (posting) return posting
    } catch {
      // Ignore unrelated or malformed public JSON-LD blocks.
    }
  }
  return null
}

const extractJsonLdLocation = (posting = {}) => {
  const jobLocation = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation
  const address = jobLocation?.address || {}
  const city = normalizeWhitespace(address.addressLocality)
  const region = normalizeWhitespace(address.addressRegion)
  const country = normalizeWhitespace(address.addressCountry)
  const countryLabel = country === 'IN' ? 'India' : country
  return [city, region, countryLabel].filter(Boolean).join(', ') || null
}

const extractIdentifier = (value) => normalizeWhitespace(
  typeof value === 'object' ? value?.value || value?.['@id'] : value,
)

const extractListingCards = (html) => [
  ...String(html ?? '').matchAll(/<(li|article)\b[^>]*>[\s\S]*?<a\b[^>]+href=["'][^"']+\/job\/R-\d+[^"']*["'][\s\S]*?<\/\1>/gi),
].map((match) => match[0])

const extractPreloadJobs = (html) => {
  const payload = extractFirst(/window\.__PRELOAD_STATE__\s*=\s*([\s\S]*?);\s*<\/script>/i, html)
  if (!payload) return []
  try {
    return JSON.parse(payload)?.jobSearch?.jobs || []
  } catch {
    return []
  }
}

const normalizeListing = ({ title, department, location, city, jobId, brand, sourceUrl }) => {
  if (!title || !jobId || !sourceUrl || !location || !INDIA_LOCATION_PATTERN.test(location) || brand?.toUpperCase() !== 'NIKE') {
    return null
  }

  return {
    title,
    department,
    location,
    city: city || extractCity(location),
    jobId,
    requisitionId: jobId,
    sourceUrl,
  }
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1)
  return normalizedPage === 1 ? SEARCH_URL : `${SEARCH_URL}/page/${normalizedPage}`
}

export const extractSearchResults = (html) => {
  const preloadJobs = extractPreloadJobs(html)
  if (preloadJobs.length > 0) {
    return preloadJobs.map((job) => {
      const location = job.locations?.[0]
      const department = job.jobCardExtraFields?.find(
        (field) => field.attribute_name === 'job_categories',
      )?.value?.[0] || null

      return normalizeListing({
        title: normalizeWhitespace(job.title),
        department: normalizeWhitespace(department),
        location: normalizeWhitespace(location?.locationText) || [
          location?.city,
          location?.state,
          location?.country,
        ].filter(Boolean).join(', '),
        city: normalizeWhitespace(location?.city),
        jobId: normalizeWhitespace(job.requisitionID || job.reference),
        brand: normalizeWhitespace(job.brandName),
        sourceUrl: toNikeUrl(job.originalURL, { jobOnly: true }),
      })
    }).filter(Boolean)
  }

  return extractListingCards(html)
  .map((cardHtml) => {
    const sourceUrl = toNikeUrl(
      extractFirst(/<a\b[^>]+href=["']([^"']+\/job\/R-\d+[^"']*)["']/i, cardHtml),
      { jobOnly: true },
    )
    const title = normalizeWhitespace(extractFirst(
      /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i,
      cardHtml,
      (match) => stripTags(match[1]),
    ))
    const jobId = normalizeWhitespace(extractFirst(/\bR-\d+\b/i, cardHtml, (match) => match[0]))
    const location = normalizeWhitespace(extractFirst(
      /Job Location\s*([^<]+)/i,
      cardHtml,
    ))
    const department = normalizeWhitespace(extractFirst(
      /Job Location[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
      cardHtml,
      (match) => stripTags(match[1]),
    ))
    const brand = normalizeWhitespace(
      extractFirst(/data-brand=["']([^"']+)["']/i, cardHtml)
      || extractFirst(/\bBrand\s*:?\s*(NIKE|JORDAN|CONVERSE)\b/i, stripTags(cardHtml)),
    )

    return normalizeListing({
      title,
      department,
      location,
      city: extractCity(location),
      jobId,
      brand,
      sourceUrl,
    })
  })
  .filter(Boolean)
}

export const extractPaginationSummary = (html) => {
  const nextPage = Number.parseInt(extractFirst(
    /<a\b[^>]+href=["']\/jobs\/page\/(\d+)[^"']*["'][^>]*aria-label=["'][^"']*next page/i,
    html,
  ) || '', 10)

  return {
    hasNext: Number.isFinite(nextPage),
    nextPage: Number.isFinite(nextPage) ? nextPage : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const posting = extractJobPosting(html)
  const location = extractJsonLdLocation(posting) || listing.location || null
  const jobId = extractIdentifier(posting?.identifier) || listing.jobId || null
  const applyUrl = toNikeUrl(extractFirst(
    /<a\b[^>]+href=["']([^"']+)["'][^>]*>(?:[\s\S]*?\bApply(?: Now)?\b[\s\S]*?)<\/a>/i,
    html,
  ))

  return {
    title: normalizeWhitespace(posting?.title) || normalizeWhitespace(
      extractFirst(/<meta\b[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i, html),
    )?.replace(/\s*\|\s*Nike Careers\s*$/i, '') || listing.title || null,
    department: normalizeWhitespace(posting?.occupationalCategory) || listing.department || null,
    location,
    city: extractCity(location) || listing.city || null,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    employmentType: normalizeWhitespace(posting?.employmentType) || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(posting?.datePosted) || null,
    closingDate: normalizeWhitespace(posting?.validThrough) || null,
    applyUrl: applyUrl || listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
    jobDescription: stripTags(posting?.description || extractFirst(/<meta\b[^>]+name=["']description["'][^>]+content=["']([^"']+)/i, html)),
  }
}

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify Nike scraper)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const run = async () => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1

  for (let page = 1; page <= maxPages; page += 1) {
    const listingUrl = buildSearchUrl({ page })
    const listingHtml = await fetchText(listingUrl)
    const listings = extractSearchResults(listingHtml)
    const pagination = extractPaginationSummary(listingHtml)

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)
      const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
      jobs.push({
        ...listing,
        ...detail,
        company: 'Nike',
        link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
        source: 'nike',
        remoteStatus: /remote/i.test(detail.location || '') ? 'Remote' : 'On-site',
        scrapedAt: new Date().toISOString(),
      })
    }

    if (!pagination.hasNext || pagination.nextPage !== page + 1) break
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'nike')
}
