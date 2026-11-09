import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobs.worldline.com'
export const SEARCH_PAGE_URL = `${BASE_URL}/search/?locationsearch=India&q=&searchResultView=LIST`
export const SEARCH_API_URL = `${BASE_URL}/services/recruiting/v1/jobs`
const DEFAULT_LOCALE = 'en_US'
const COMPANY_NAME = 'Worldline India'
const SOURCE = 'worldlineindia'

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

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const normalizeLocation = (value) => normalizeWhitespace(value)
  ?.replace(/,\s*IND\b/i, '')
  .trim() || null

const normalizeLocationArray = (values) => unique(
  (Array.isArray(values) ? values : [])
    .map(normalizeLocation)
    .filter(Boolean),
)

const joinLocations = (values) => {
  const locations = normalizeLocationArray(values)
  return locations.length > 0 ? `${locations.join(', ')}, India` : null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildSearchRequestPayload = (pageNumber = 0) => ({
  keywords: '',
  locale: DEFAULT_LOCALE,
  location: 'India',
  pageNumber,
  sortBy: 'recent',
})

export const buildDetailUrl = (title, jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/job/${decodeHtmlEntities(title)}/${jobId}-${locale}/`

export const buildApplyUrl = (jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/talentcommunity/apply/${jobId}/?locale=${locale}`

export const normalizeEmploymentType = (title) => {
  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || ''
  if (/intern|internship|co-op|apprentice/.test(normalizedTitle)) return 'Internship'
  if (/contract|contractor|freelance/.test(normalizedTitle)) return 'Contract'
  return 'Full-time'
}

export const extractSearchSummary = (payload) => ({
  totalJobCount: Number.isFinite(payload?.totalJobs) ? payload.totalJobs : null,
  pageSize: Array.isArray(payload?.jobSearchResult) ? payload.jobSearchResult.length : 0,
})

export const extractSearchResults = (payload) => {
  if (!Array.isArray(payload?.jobSearchResult)) return []

  return payload.jobSearchResult
    .map((entry) => entry?.response || null)
    .filter(Boolean)
    .filter((record) => (record.jobLocationShort || []).some((value) => /\bIND\b|\bIndia\b/i.test(String(value))))
    .map((record) => {
      const title = normalizeWhitespace(record.unifiedStandardTitle)
      const jobId = normalizeWhitespace(record.id)
      const locations = normalizeLocationArray(record.sfstd_jobLocation_obj || record.jobLocationShort)
      const location = joinLocations(record.sfstd_jobLocation_obj || record.jobLocationShort || locations)
      const urlTitle = normalizeWhitespace(record.unifiedUrlTitle || record.urlTitle || title)

      if (!title || !jobId || !location || !urlTitle) return null

      return {
        title,
        location,
        city: locations[0] || null,
        state: null,
        jobId,
        requisitionId: jobId,
        sourceUrl: buildDetailUrl(urlTitle, jobId),
        applyUrl: buildApplyUrl(jobId),
        postingDate: normalizeWhitespace(record.unifiedStandardStart),
        closingDate: normalizeWhitespace(record.unifiedStandardEnd),
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  const jobId = normalizeWhitespace(
    extractFirst(/jobID\s*:\s*(\d+)/i, html),
  ) || listing.jobId || null
  const applyPath = normalizeWhitespace(
    extractFirst(/<a[^>]*class="[^"]*\bdialogApplyBtn\b[^"]*"[^>]*href="([^"]+)"/i, html),
  )

  return {
    title,
    location: listing.location || null,
    city: listing.city || null,
    state: listing.state || null,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: normalizeEmploymentType(title),
    experienceRequired: listing.experienceRequired || null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    applyUrl: applyPath ? new URL(decodeHtmlEntities(applyPath), BASE_URL).toString() : buildApplyUrl(jobId),
    sourceUrl: listing.sourceUrl || (title && jobId ? buildDetailUrl(title, jobId) : null),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createWorldlineIndiaScraper = () => ({
  async run({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchJson = defaultFetchJson,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()

    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      const payload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        body: JSON.stringify(buildSearchRequestPayload(pageNumber)),
      })
      const listings = extractSearchResults(payload)
      const summary = extractSearchSummary(payload)

      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: COMPANY_NAME,
          department: null,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          state: detail.state || listing.state,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate || listing.closingDate,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      const totalJobCount = summary.totalJobCount || 0
      const pageSize = summary.pageSize || listings.length
      if ((pageNumber + 1) * pageSize >= totalJobCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createWorldlineIndiaScraper().run(options)
