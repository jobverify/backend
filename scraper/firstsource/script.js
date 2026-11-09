import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.firstsource.com'
export const INDIA_SEARCH_URL = `${BASE_URL}/India/go/India-Jobs/655444/`

const COMPANY_NAME = 'Firstsource Solutions Limited'
const SOURCE = 'firstsource'

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toOfficialUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized, BASE_URL)
    return url.origin === BASE_URL ? url.toString() : null
  } catch {
    return null
  }
}

const extractJobIdFromUrl = (value) => extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value)

const isIndiaLocation = (location) => /(?:\bIN\b|\bIndia\b)/i.test(location ?? '')

const normalizePostingDate = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(text)
  if (!match) return text

  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .indexOf(match[2])
  if (month < 0) return text

  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

const extractLabelValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return normalizeWhitespace(extractFirst(
    new RegExp(`<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i'),
    html,
  ))
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(jobDescription)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(/<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => {
    const row = match[1]
    const linkMatch = /<a\b(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/i.exec(row)
    const title = normalizeWhitespace(linkMatch?.[2])
    const sourceUrl = toOfficialUrl(linkMatch?.[1])
    const location = normalizeWhitespace(extractFirst(/<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row))
    const jobId = extractJobIdFromUrl(sourceUrl)
    const postingDate = normalizePostingDate(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobDate[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )

    if (!title || !location || !isIndiaLocation(location) || !sourceUrl || !jobId) return null

    return {
      title,
      location,
      city: location.split(',')[0]?.trim() || null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      postingDate,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => ({
  nextUrl: toOfficialUrl(extractFirst(/<a\b[^>]*class=["'][^"']*next[^"']*["'][^>]*href=["']([^"']+)["']/i, html)),
})

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i, html)
  const jobDescription = stripTags(descriptionHtml)
  const experienceRequired = (
    extractLabelValue(html, 'Work experience:')
    || inferExperienceFromDescription(jobDescription)
    || null
  )
  const title = normalizeWhitespace(
    extractFirst(/<(?:h1|span)\b[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/(?:h1|span)>/i, html),
  ) || listing.title || null
  const location = extractLabelValue(html, 'Location(s):') || listing.location || null

  return {
    title,
    location,
    city: location?.split(',')[0]?.trim() || listing.city || null,
    jobId: listing.jobId || extractJobIdFromUrl(listing.sourceUrl),
    requisitionId: extractLabelValue(html, 'Requisition ID:') || listing.requisitionId || null,
    employmentType: extractLabelValue(html, 'Type of position:') || null,
    experienceRequired,
    jobDescription,
    publicExperienceChecked: Boolean(jobDescription || experienceRequired),
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeWhitespace(
      extractFirst(/<meta\b[^>]*itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, html),
    ) || listing.postingDate || null,
    applyUrl: toOfficialUrl(
      extractFirst(/<a\b[^>]*class=["'][^"']*apply[^"']*["'][^>]*href=["']([^"']+)["']/i, html),
    ) || listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify Firstsource scraper)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createFirstsourceScraper = () => ({
  async run({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()
    let nextUrl = INDIA_SEARCH_URL
    let page = 0

    while (nextUrl && page < maxPages) {
      page += 1
      const listingHtml = await fetchText(nextUrl)
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)

      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
        if (!isIndiaLocation(detail.location)) continue

        jobs.push({
          ...detail,
          company: COMPANY_NAME,
          link: detail.applyUrl || detail.sourceUrl,
          source: SOURCE,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      nextUrl = summary.nextUrl
    }

    return jobs
  },
})

export const run = async (options = {}) => createFirstsourceScraper().run(options)
